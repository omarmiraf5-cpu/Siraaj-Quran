import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { PROVISIONED } from "@/lib/accountProvisioning";

// inviteUserByEmail's link lands on whatever Site URL the Supabase project
// has configured, and this app has no page yet that reads an invite token
// from the URL and lets someone set a password — so a real invite email
// would currently dead-end. Creating the account with a temporary password
// instead means the admin can hand it over and the person can sign in right
// away with the existing login form.
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

const ALLOWED_ROLES = ["teacher", "parent"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Both handlers below start the same way: prove there's a session, and that
// it belongs to an admin. Shared so the reset path can't drift into being
// the more permissive of the two.
async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (callerError || !caller || caller.role !== "admin") {
    // This 403 has fired for accounts that really were role='admin' in the
    // table, so the generic message alone wasn't enough to tell a missing
    // row apart from a wrong role apart from an RLS/session problem. Log
    // the real cause server-side and echo a short hint in the response so
    // it's visible without needing Vercel log access.
    console.error("Admin check failed:", {
      userId: user.id,
      callerError: callerError?.message,
      callerErrorCode: callerError?.code,
      caller,
    });
    return {
      error: NextResponse.json(
        {
          error: "Only an admin can manage accounts",
          debug: callerError
            ? `${callerError.code ?? ""} ${callerError.message}`.trim()
            : caller
            ? `signed-in account has role "${caller.role}", not admin`
            : "no profile row is visible for this session",
        },
        { status: 403 }
      ),
    };
  }

  return { caller };
}

// Creating any account needs Supabase's admin API (to write the auth.users
// row), which requires the service-role key — an RLS-scoped session can
// never do that on its own, so this always goes through the server.
//
// Students are deliberately not creatable here: they are records rather
// than logins, and giving one an email/password account is a different
// decision from adding them to the roster.
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const { role, full_name, email, student_ids } = await req.json();

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!full_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "full_name and email are required" },
        { status: 400 }
      );
    }

    const auth = await requireAdmin(supabase);
    if (auth.error) return auth.error;
    const { caller } = auth;

    // The on_auth_user_created trigger reads this metadata to fill in the
    // new profiles row, so the account lands in the right school with the
    // right role the moment it exists.
    const admin = createAdminClient();
    const tempPassword = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      app_metadata: PROVISIONED,
      user_metadata: {
        role: role as AllowedRole,
        full_name: full_name.trim(),
        school_id: caller.school_id,
        // Read by /change-password and the login redirect — nobody but the
        // admin who just generated it knows this password, so the person
        // has to set their own before they can use the rest of the app.
        must_change_password: true,
      },
    });

    if (error) throw error;

    // Linking a parent to their children runs as the admin's own session,
    // not the service role — the "Admins can manage parent links" policy
    // already covers it, and elevated privileges are worth keeping to the
    // one step that genuinely can't be done without them.
    let linked = 0;
    if (role === "parent" && Array.isArray(student_ids) && student_ids.length > 0) {
      const { error: linkError } = await supabase.from("parent_students").insert(
        student_ids.map((student_id: string) => ({
          parent_id: data.user.id,
          student_id,
        }))
      );
      // The account itself is already real at this point, so a failed link
      // is reported alongside it rather than pretending nothing happened.
      if (linkError) {
        return NextResponse.json(
          {
            id: data.user.id,
            email: data.user.email,
            temp_password: tempPassword,
            warning: `Account created, but linking children failed: ${linkError.message}`,
          },
          { status: 201 }
        );
      }
      linked = student_ids.length;
    }

    return NextResponse.json(
      { id: data.user.id, email: data.user.email, temp_password: tempPassword, linked },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating account:", error);
    const message = error instanceof Error ? error.message : "Failed to create account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Issues a fresh temporary password for a teacher or parent who no longer
// has theirs. Without this the only copy of a temp password is the one the
// admin was shown once when the account was made, and losing it meant the
// school had to come back to whoever holds the Supabase dashboard — the app
// itself could already reset a child's PIN but not an adult's password.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const auth = await requireAdmin(supabase);
    if (auth.error) return auth.error;
    const { caller } = auth;

    const admin = createAdminClient();

    // Read the target with the service role, then check it against the
    // caller's own school here. Going through the admin's RLS-scoped session
    // instead would make "not in your school" and "no such account" look
    // identical, and this has to refuse the first case loudly.
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, role, school_id, full_name, email")
      .eq("id", user_id)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json({ error: "No such account" }, { status: 404 });
    }
    if (target.school_id !== caller.school_id) {
      return NextResponse.json(
        { error: "That account belongs to a different school" },
        { status: 403 }
      );
    }
    if (!ALLOWED_ROLES.includes(target.role as AllowedRole)) {
      return NextResponse.json(
        { error: `Cannot reset a ${target.role} account here` },
        { status: 400 }
      );
    }

    // Merged rather than replaced: updateUserById overwrites user_metadata
    // wholesale, and dropping role/school_id from it would orphan the
    // account from its school on any later read of that metadata.
    const { data: existing } = await admin.auth.admin.getUserById(user_id);
    const tempPassword = generateTempPassword();

    const { error: updateError } = await admin.auth.admin.updateUserById(user_id, {
      password: tempPassword,
      user_metadata: {
        ...(existing?.user?.user_metadata ?? {}),
        must_change_password: true,
      },
    });
    if (updateError) throw updateError;

    return NextResponse.json({
      id: target.id,
      full_name: target.full_name,
      email: target.email,
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error("Error resetting account password:", error);
    const message = error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
