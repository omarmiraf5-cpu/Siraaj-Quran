import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPin, studentLoginPassword } from "@/lib/studentAuth";

// A student changing their own PIN: the one they have now, then a new one.
// Their sign-in's password follows the PIN, and the office still reads the
// new one back to whoever forgets it. Only a student's own login, for its
// own student.

/** POST { current, next } → { ok: true } */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (me?.role !== "student" || me.active === false) {
    return NextResponse.json({ error: "Only a student can change their PIN here" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (!isValidPin(next)) return NextResponse.json({ error: "Your new PIN must be 4 numbers" }, { status: 400 });
  if (next === current) return NextResponse.json({ error: "Pick a PIN that's different from the one you have" }, { status: 400 });

  const admin = createAdminClient();
  const { data: student } = await admin.from("students").select("id, pin").eq("profile_id", user.id).maybeSingle();
  if (!student) return NextResponse.json({ error: "Your school hasn't linked this sign-in to you" }, { status: 404 });
  if (!student.pin || student.pin !== current) {
    return NextResponse.json({ error: "That isn't your PIN now. Ask your teacher if you've forgotten it." }, { status: 400 });
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
    password: studentLoginPassword(student.id as string, next),
  });
  if (passwordError) {
    console.error("Student PIN: couldn't change the sign-in", passwordError);
    return NextResponse.json({ error: "Couldn't change your PIN. Please try again." }, { status: 500 });
  }
  const { error: saveError } = await admin.from("students").update({ pin: next }).eq("id", student.id);
  if (saveError) {
    // The sign-in has the new PIN already; put it back so the two agree.
    await admin.auth.admin.updateUserById(user.id, { password: studentLoginPassword(student.id as string, current) });
    console.error("Student PIN: couldn't save it", saveError);
    return NextResponse.json({ error: "Couldn't change your PIN. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
