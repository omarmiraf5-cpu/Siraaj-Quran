import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (!caller || caller.role !== "admin") {
      return NextResponse.json(
        { error: "Only an admin can create accounts" },
        { status: 403 }
      );
    }

    // The on_auth_user_created trigger reads this metadata to fill in the
    // new profiles row, so the account lands in the right school with the
    // right role the moment it exists.
    const admin = createAdminClient();
    const tempPassword = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: role as AllowedRole,
        full_name: full_name.trim(),
        school_id: caller.school_id,
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
