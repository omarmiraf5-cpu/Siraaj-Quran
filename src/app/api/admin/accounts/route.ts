import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import { sendAccountWelcomes, sendPasswordResetLink, sendSchoolJoined } from "@/lib/accountWelcome";
import { addSchool } from "@/lib/schoolMemberships";
import { ACCOUNT_ROLES, requireAdmin, schoolAccount, type AccountRole } from "@/lib/adminAccounts";

// Accounts are made with a temporary password the admin can hand over, so
// the person can sign in straight away. They're also emailed a welcome with
// a link to choose their own password (lib/accountWelcome); the temporary
// one is the way in if that email doesn't arrive.
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

const ALLOWED_ROLES = ACCOUNT_ROLES;
type AllowedRole = AccountRole;

/**
 * Why an email that already signs in to MyDiiwaan can't have a second login,
 * and what to do instead — Supabase's own "already been registered" said
 * nothing about whose it is. Null when nobody has it.
 */
async function loginInTheWay(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  role: AllowedRole,
  caller: { school_id: string | null },
  callerId: string
): Promise<string | null> {
  const { data: holder } = await admin
    .from("profiles")
    .select("id, role, school_id, full_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!holder) return null;
  const name = holder.full_name || email;
  if (holder.school_id !== caller.school_id) {
    return `${email} already has a MyDiiwaan login, so it can't be used for a new one. Use another email.`;
  }
  if (holder.id === callerId) {
    return role === "teacher"
      ? "That's your own login, and you can teach with it — there's no second login to make. Tick yourself as a teacher on your halaqa, under Halaqas."
      : "That's your own login, which runs the school. A parent needs a login of their own — use another email.";
  }
  if (holder.role === role) {
    return `${name} is already one of your ${role}s.`;
  }
  if (holder.role === "admin") {
    return role === "teacher"
      ? `${name} is an admin here and can teach with that same login — tick them as a teacher on the halaqa, under Halaqas.`
      : `${email} is ${name}'s admin login here. A parent needs a login of their own — use another email.`;
  }
  return `${email} is ${name}'s ${holder.role} login here. One login can't be both, so use another email for this ${role}.`;
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
    const { caller, user } = auth;

    // createProvisionedUser gives the new login its profile, so the account
    // lands in the right school with the right role the moment it exists.
    const admin = createAdminClient();

    // Already a teacher at another school: this school becomes one of
    // theirs, on the login they have, rather than a second login to keep
    // apart. They switch between their schools from the menu.
    if (role === "teacher") {
      const { data: holder } = await admin
        .from("profiles")
        .select("id, role, school_id, full_name, active")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (holder && holder.role === "teacher" && holder.school_id && holder.school_id !== caller.school_id) {
        const name = holder.full_name || email.trim();
        let outcome: Awaited<ReturnType<typeof addSchool>>;
        try {
          outcome = await addSchool(admin, holder, caller.school_id as string);
        } catch (joinError) {
          console.error("Accounts: couldn't add a school to a teacher", joinError);
          return NextResponse.json(
            {
              error: /school_memberships/.test(String((joinError as { message?: string })?.message))
                ? "Teachers at more than one school need the update run in Supabase first (mydiiwaan-update-10.sql)."
                : "Couldn't add them to your school. Please try again.",
            },
            { status: 500 }
          );
        }
        if (!outcome.added) {
          return NextResponse.json(
            {
              error:
                outcome.reason === "already"
                  ? `${name} is already one of your teachers.`
                  : `${name} is one of your teachers, switched off. Open them below and tick Active.`,
            },
            { status: 409 }
          );
        }
        if (outcome.movedIn) await admin.auth.admin.updateUserById(holder.id, { ban_duration: "none" });
        const { data: schools } = await admin.from("schools").select("id, name").in("id", [caller.school_id, holder.school_id]);
        const nameOf = (id: string | null) => (schools ?? []).find((x: { id: string }) => x.id === id)?.name ?? "";
        const told = await sendSchoolJoined(
          { name, email: email.trim().toLowerCase() },
          { name: nameOf(caller.school_id) || "Your school", otherSchool: outcome.movedIn ? "" : nameOf(holder.school_id), replyTo: user.email }
        );
        return NextResponse.json(
          {
            id: holder.id,
            email: email.trim().toLowerCase(),
            full_name: holder.full_name,
            joined: true,
            other_school: nameOf(holder.school_id),
            welcome_email: told.ok ? "sent" : told.reason,
          },
          { status: 201 }
        );
      }
    }

    // One of the school's own teachers, or its office, who is also a parent
    // here: their children are linked to the login they already have, and
    // they see them in parent mode — no second login.
    if (role === "parent") {
      const { data: staff } = await admin
        .from("profiles")
        .select("id, role, school_id, full_name")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (staff && staff.school_id === caller.school_id && (staff.role === "teacher" || staff.role === "admin")) {
        const ids = Array.isArray(student_ids) ? (student_ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
        if (ids.length === 0) {
          return NextResponse.json(
            { error: `${staff.full_name || email.trim()} is one of your ${staff.role === "admin" ? "admins" : "teachers"} — tick their children so they can see them in parent mode.` },
            { status: 400 }
          );
        }
        // Only this school's children, as the admin's own session can see them.
        const { data: ours } = await supabase.from("students").select("id").in("id", ids).eq("school_id", caller.school_id);
        const valid = (ours ?? []).map((s: { id: string }) => s.id);
        if (valid.length === 0) return NextResponse.json({ error: "Those children aren't in your school" }, { status: 400 });
        const { error: linkError } = await supabase
          .from("parent_students")
          .upsert(valid.map((student_id) => ({ parent_id: staff.id, student_id })), { onConflict: "parent_id,student_id", ignoreDuplicates: true });
        if (linkError) throw linkError;
        return NextResponse.json(
          { id: staff.id, email: email.trim().toLowerCase(), full_name: staff.full_name, staff_parent: staff.role, linked: valid.length },
          { status: 201 }
        );
      }
    }

    const inTheWay = await loginInTheWay(admin, email.trim(), role as AllowedRole, caller, user.id);
    if (inTheWay) return NextResponse.json({ error: inTheWay }, { status: 409 });
    const tempPassword = generateTempPassword();
    const { data, error } = await createProvisionedUser(admin, {
      email: email.trim(),
      password: tempPassword,
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

    if (error) {
      // A login with no profile to say whose it is.
      if (error.code === "email_exists" || /already (been )?registered/i.test(error.message)) {
        return NextResponse.json(
          { error: `${email.trim()} already has a MyDiiwaan login, so it can't be used for a new one. Use another email.` },
          { status: 409 }
        );
      }
      throw error;
    }

    // Linking a parent to their children runs as the admin's own session,
    // not the service role — the "Admins can manage parent links" policy
    // already covers it, and elevated privileges are worth keeping to the
    // one step that genuinely can't be done without them.
    let linked = 0;
    let warning: string | undefined;
    if (role === "parent" && Array.isArray(student_ids) && student_ids.length > 0) {
      const { error: linkError } = await supabase.from("parent_students").insert(
        student_ids.map((student_id: string) => ({
          parent_id: data.user.id,
          student_id,
        }))
      );
      // The account itself is already real at this point, so a failed link
      // is reported alongside it rather than pretending nothing happened.
      if (linkError) warning = `Account created, but linking children failed: ${linkError.message}`;
      else linked = student_ids.length;
    }

    // Their welcome, with a link to choose their own password. Waited for,
    // so the admin sees whether it went; replies go to the admin.
    const [{ data: school }, { data: children }] = await Promise.all([
      admin.from("schools").select("name").eq("id", caller.school_id).maybeSingle(),
      linked > 0
        ? admin.from("students").select("full_name").in("id", student_ids).eq("school_id", caller.school_id)
        : Promise.resolve({ data: [] as Array<{ full_name: string }> }),
    ]);
    const welcome = await sendAccountWelcomes(
      [
        {
          userId: data.user.id,
          name: full_name.trim(),
          email: data.user.email ?? email.trim(),
          role: role as AllowedRole,
          children: (children ?? []).map((c: { full_name: string }) => c.full_name),
        },
      ],
      { name: school?.name ?? "Your school", replyTo: user.email }
    );

    return NextResponse.json(
      {
        id: data.user.id,
        email: data.user.email,
        temp_password: tempPassword,
        linked,
        ...(warning ? { warning } : {}),
        // "sent", or why it wasn't.
        welcome_email: welcome.ok ? "sent" : welcome.reason,
      },
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
    const { user_id, by } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const auth = await requireAdmin(supabase);
    if (auth.error) return auth.error;
    const { caller, user } = auth;

    const admin = createAdminClient();
    const found = await schoolAccount(admin, caller, user_id);
    if (found.error) return found.error;
    const { target } = found;

    // Or the office emails them a link to choose a new one themselves,
    // leaving their current password as it is until they do.
    if (by === "email") {
      if (target.active === false) {
        return NextResponse.json(
          { error: `${target.full_name || "This account"} is switched off. Switch them back on first.` },
          { status: 400 }
        );
      }
      if (!target.email) {
        return NextResponse.json({ error: "This account has no email to send to." }, { status: 400 });
      }
      const { data: school } = await admin.from("schools").select("name").eq("id", caller.school_id).maybeSingle();
      const sent = await sendPasswordResetLink(
        { userId: target.id, name: target.full_name ?? "", email: target.email },
        { name: school?.name ?? "Your school", replyTo: user.email }
      );
      if (!sent.ok) {
        return NextResponse.json({ error: `The email didn't send: ${sent.reason}` }, { status: 502 });
      }
      return NextResponse.json({ id: target.id, full_name: target.full_name, email: target.email, emailed: true });
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
