import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminAccounts";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import { studentLoginEmail } from "@/lib/studentAuth";
import { randomStudentPassword } from "@/lib/studentAuthServer";

// Puts right the sign-in of students who already have a PIN but still can't
// use it: the login behind it is missing, under another email, switched off,
// or isn't a student of this school. Their PIN is never changed, so a printed
// list stays good. Checked a batch at a time; the Students page keeps asking.

export const maxDuration = 60;
const BATCH = 20;

/** POST { after?: string } → { checked, repaired: [{ id, name, what }], failed: [{ id, name, error }], next: string | null } */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const schoolId = auth.caller.school_id;
  if (!schoolId) return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { after?: unknown };
  const after = typeof body.after === "string" ? body.after : "";

  const admin = createAdminClient();
  let query = admin
    .from("students")
    .select("id, full_name, profile_id")
    .eq("school_id", schoolId)
    .eq("active", true)
    .not("pin", "is", null)
    .not("profile_id", "is", null)
    .order("id")
    .limit(BATCH);
  if (after) query = query.gt("id", after);
  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const repaired: Array<{ id: string; name: string; what: string }> = [];
  const failed: Array<{ id: string; name: string; error: string }> = [];

  for (const s of (students ?? []) as Array<{ id: string; full_name: string; profile_id: string }>) {
    try {
      const fixes: string[] = [];
      const wantEmail = studentLoginEmail(s.id);
      const { data: found } = await admin.auth.admin.getUserById(s.profile_id);
      let profileId = s.profile_id;

      if (!found?.user) {
        // The login is gone: made again, and the student pointed at it. The PIN stays.
        const { data: login, error: loginError } = await createProvisionedUser(admin, {
          email: wantEmail,
          password: randomStudentPassword(),
          user_metadata: { role: "student", full_name: s.full_name, school_id: schoolId },
        });
        if (loginError || !login.user) throw new Error(loginError?.message ?? "Couldn't make their sign-in");
        profileId = login.user.id;
        const { error: saveError } = await admin.from("students").update({ profile_id: profileId }).eq("id", s.id);
        if (saveError) throw saveError;
        fixes.push("sign-in made again");
      } else {
        const user = found.user;
        const changes: { email?: string; email_confirm?: boolean; ban_duration?: string } = {};
        if ((user.email ?? "").toLowerCase() !== wantEmail.toLowerCase()) {
          changes.email = wantEmail;
          changes.email_confirm = true;
          fixes.push("sign-in email corrected");
        }
        const bannedUntil = (user as { banned_until?: string | null }).banned_until;
        if (bannedUntil && Date.parse(bannedUntil) > Date.now()) {
          changes.ban_duration = "none";
          fixes.push("sign-in switched back on");
        }
        if (Object.keys(changes).length > 0) {
          const { error: updateError } = await admin.auth.admin.updateUserById(profileId, changes);
          if (updateError) throw updateError;
        }
      }

      const { data: profile } = await admin.from("profiles").select("role, school_id").eq("id", profileId).maybeSingle();
      if (!profile || profile.role !== "student" || profile.school_id !== schoolId) {
        const { error: profileError } = profile
          ? await admin.from("profiles").update({ role: "student", school_id: schoolId, full_name: s.full_name }).eq("id", profileId)
          : await admin.from("profiles").insert({ id: profileId, role: "student", school_id: schoolId, full_name: s.full_name });
        if (profileError) throw profileError;
        fixes.push("account put right");
      }

      if (fixes.length > 0) {
        await admin.from("student_signin_guard").delete().eq("student_id", s.id);
        repaired.push({ id: s.id, name: s.full_name, what: fixes.join(", ") });
      }
    } catch (e) {
      console.error(`Student repair: "${s.full_name}" failed`, e);
      failed.push({ id: s.id, name: s.full_name, error: e instanceof Error ? e.message : "Couldn't repair it" });
    }
  }

  const list = (students ?? []) as Array<{ id: string }>;
  return NextResponse.json({
    checked: list.length,
    repaired,
    failed,
    next: list.length === BATCH ? list[list.length - 1].id : null,
  });
}
