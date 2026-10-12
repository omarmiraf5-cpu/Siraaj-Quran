import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminAccounts";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import { studentLoginEmail } from "@/lib/studentAuth";
import { randomStudentPassword } from "@/lib/studentAuthServer";

// PINs for every student who can't sign in yet, a batch at a time: the
// office presses one button and the Students page keeps asking until none
// are left. Each gets a fresh four-digit PIN and, if they have none, their
// sign-in. Students who already have a PIN keep it.

export const maxDuration = 60;
const BATCH = 25;
const randomPin = () => String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));

/** POST { skip?: string[] } → { results: [{ id, name, pin } | { id, name, error }], remaining } */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const schoolId = auth.caller.school_id;
  if (!schoolId) return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { skip?: unknown };
  // Students a batch couldn't do already: not tried again in this run.
  const skip = Array.isArray(body.skip) ? body.skip.filter((x): x is string => typeof x === "string").slice(0, 2000) : [];

  const admin = createAdminClient();
  let query = admin
    .from("students")
    .select("id, full_name, profile_id")
    .eq("school_id", schoolId)
    .eq("active", true)
    .or("pin.is.null,profile_id.is.null")
    .order("full_name")
    .limit(BATCH);
  if (skip.length > 0) query = query.not("id", "in", `(${skip.join(",")})`);
  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; name: string; pin?: string; error?: string }> = [];
  for (const s of (students ?? []) as Array<{ id: string; full_name: string; profile_id: string | null }>) {
    const pin = randomPin();
    try {
      let profileId = s.profile_id;
      if (profileId) {
        const { error: passwordError } = await admin.auth.admin.updateUserById(profileId, {
          password: randomStudentPassword(),
        });
        if (passwordError) throw passwordError;
        // And their sign-in put right, if it isn't a student's of this school.
        const { error: profileError } = await admin
          .from("profiles")
          .update({ role: "student", school_id: schoolId, full_name: s.full_name })
          .eq("id", profileId);
        if (profileError) throw profileError;
      } else {
        const { data: login, error: loginError } = await createProvisionedUser(admin, {
          email: studentLoginEmail(s.id),
          password: randomStudentPassword(),
          user_metadata: { role: "student", full_name: s.full_name, school_id: schoolId },
        });
        if (loginError || !login.user) throw new Error(loginError?.message ?? "Couldn't make their sign-in");
        profileId = login.user.id;
      }
      const { error: saveError } = await admin.from("students").update({ pin, profile_id: profileId }).eq("id", s.id);
      if (saveError) throw saveError;
      await admin.from("student_signin_guard").delete().eq("student_id", s.id);
      results.push({ id: s.id, name: s.full_name, pin });
    } catch (e) {
      console.error(`Student PINs: "${s.full_name}" failed`, e);
      results.push({ id: s.id, name: s.full_name, error: e instanceof Error ? e.message : "Couldn't give them a PIN" });
    }
  }

  const done = new Set([...skip, ...results.filter((r) => r.error).map((r) => r.id)]);
  let rest = admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("active", true)
    .or("pin.is.null,profile_id.is.null");
  if (done.size > 0) rest = rest.not("id", "in", `(${[...done].join(",")})`);
  const { count } = await rest;
  return NextResponse.json({ results, remaining: count ?? 0 });
}
