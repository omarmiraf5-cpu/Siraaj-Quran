import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readWelcomeToken, welcomeSpent } from "@/lib/welcomeLink";

/* eslint-disable @typescript-eslint/no-explicit-any */

// The link in a new teacher's or parent's welcome email (lib/welcomeLink).
// GET says whose it is, for the page to greet them; POST sets the password
// they choose. Only the POST spends the link, so mail scanners that open
// links before the reader does can't use it up.

type Refusal = "invalid" | "expired" | "used" | "off";
const STATUS: Record<Refusal, number> = { invalid: 400, expired: 410, used: 410, off: 403 };
const refuse = (reason: Refusal) => NextResponse.json({ error: reason }, { status: STATUS[reason] });

/** The account a link is for, if the link is good and the account still wants it. */
async function accountFor(token: unknown) {
  const read = readWelcomeToken(token);
  if (!read.ok) return { refusal: read.reason };
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(read.userId);
  const user = data?.user;
  if (!user) return { refusal: "invalid" as const };
  if (welcomeSpent(user.app_metadata, read.issuedAt)) return { refusal: "used" as const };
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, active, school_id")
    .eq("id", user.id)
    .maybeSingle();
  // Only ever sent to teachers and parents.
  if (!profile || !["teacher", "parent"].includes(profile.role)) return { refusal: "invalid" as const };
  if (profile.active === false) return { refusal: "off" as const };
  const { data: school } = await admin.from("schools").select("name").eq("id", profile.school_id).maybeSingle();
  return { admin, user, profile, schoolName: (school?.name as string | undefined) ?? "" };
}

export async function GET(req: NextRequest) {
  const found = await accountFor(req.nextUrl.searchParams.get("token"));
  if ("refusal" in found) return refuse(found.refusal as Refusal);
  return NextResponse.json({
    name: found.profile.full_name ?? "",
    email: found.user.email ?? "",
    role: found.profile.role,
    school: found.schoolName,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "Choose a password of 8 to 72 characters." }, { status: 400 });
  }

  const found = await accountFor(body.token);
  if ("refusal" in found) return refuse(found.refusal as Refusal);
  const { admin, user, profile } = found;

  // Their own password now, so the sign-in page no longer sends them to
  // choose one. user_metadata is written back whole (see the admin accounts
  // route); the stamp in app_metadata spends this link.
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: { ...(user.user_metadata ?? {}), must_change_password: false },
    app_metadata: { welcome_used_at: new Date().toISOString() },
  } as any);
  if (error) {
    return NextResponse.json({ error: error.message || "That password wasn't accepted. Try another." }, { status: 400 });
  }
  return NextResponse.json({ email: user.email, role: profile.role });
}
