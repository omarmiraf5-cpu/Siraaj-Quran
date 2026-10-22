import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPin, studentLoginEmail } from "@/lib/studentAuth";
import { PIN_REST_MINUTES, PIN_TRIES, randomStudentPassword } from "@/lib/studentAuthServer";

// The PIN pad asks here. A right PIN gets the child's login a fresh random
// password, handed back for their own device to sign in with; a wrong one
// counts, and after PIN_TRIES in a row that child's PIN is refused for
// PIN_REST_MINUTES — so four digits can't be guessed by trying them all.
// Signing in itself still happens on the child's device, as before.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST { student_id, pin } → { email, password } | { error, locked_minutes?, tries_left? } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { student_id?: unknown; pin?: unknown };
  const studentId = String(body.student_id ?? "");
  const pin = String(body.pin ?? "");
  if (!UUID.test(studentId) || !isValidPin(pin)) {
    return NextResponse.json({ error: "Pick your name and type your 4-number PIN" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, pin, profile_id, active")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.active === false) {
    return NextResponse.json({ error: "That PIN didn't work" }, { status: 401 });
  }
  // On the list, so a PIN was given, but the login behind it was never made.
  if (!student.pin || !student.profile_id) {
    console.error("Student sign-in: PIN or login missing for", studentId, { hasPin: Boolean(student.pin), hasLogin: Boolean(student.profile_id) });
    return NextResponse.json({ error: "Your sign-in isn't ready yet", code: "not_ready" }, { status: 409 });
  }

  // The count of wrong PINs. Before the database has its table, there is
  // no count — the PIN is still checked here.
  const { data: guard, error: guardError } = await admin
    .from("student_signin_guard")
    .select("failed, locked_until")
    .eq("student_id", studentId)
    .maybeSingle();
  const counting = !guardError;
  const now = Date.now();
  const lockedUntil = guard?.locked_until ? Date.parse(guard.locked_until as string) : 0;
  if (lockedUntil > now) {
    const minutes = Math.ceil((lockedUntil - now) / 60_000);
    return NextResponse.json({ error: "Too many wrong PINs", locked_minutes: minutes }, { status: 429 });
  }

  if (student.pin !== pin) {
    const failed = (lockedUntil ? 0 : ((guard?.failed as number | undefined) ?? 0)) + 1;
    if (counting) {
      const rest = failed >= PIN_TRIES;
      await admin.from("student_signin_guard").upsert({
        student_id: studentId,
        failed: rest ? 0 : failed,
        locked_until: rest ? new Date(now + PIN_REST_MINUTES * 60_000).toISOString() : null,
        updated_at: new Date(now).toISOString(),
      });
      if (rest) return NextResponse.json({ error: "Too many wrong PINs", locked_minutes: PIN_REST_MINUTES }, { status: 429 });
    }
    return NextResponse.json({ error: "That PIN didn't work", ...(counting ? { tries_left: PIN_TRIES - failed } : {}) }, { status: 401 });
  }

  const password = randomStudentPassword();
  const { error: passwordError } = await admin.auth.admin.updateUserById(student.profile_id as string, { password });
  if (passwordError) {
    console.error("Student sign-in: couldn't ready the login", passwordError);
    return NextResponse.json({ error: "Couldn't sign you in. Please try again." }, { status: 500 });
  }
  if (counting && guard) await admin.from("student_signin_guard").delete().eq("student_id", studentId);
  return NextResponse.json({ email: studentLoginEmail(studentId), password });
}
