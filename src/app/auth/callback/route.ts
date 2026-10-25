import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeOf } from "@/lib/portalAccess";

// Where Google sends people back to. Google sign-in only opens an account
// that already exists at a school (matched by email). Supabase would
// happily make a brand-new login for any Google account, so that is
// undone here: a new login with no school is deleted before it can be used.
const NEW_LOGIN_WINDOW_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url);
  const back = (reason: string) => NextResponse.redirect(`${origin}/login?google=${reason}`);

  const code = searchParams.get("code");
  if (!code) return back("failed");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back("failed");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return back("failed");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, school_id, active")
    .eq("id", user.id)
    .maybeSingle();

  const hasSchool = Boolean(profile?.school_id);

  if (!profile || !hasSchool) {
    // Nobody at any school has this email. Remove the login Google just
    // made, but only when it is brand new and only Google can open it, so a
    // real account is never touched.
    const onlyGoogle = (user.identities ?? []).length > 0 && (user.identities ?? []).every((i) => i.provider === "google");
    const brandNew = Date.now() - Date.parse(user.created_at) < NEW_LOGIN_WINDOW_MS;
    if (onlyGoogle && brandNew) await admin.auth.admin.deleteUser(user.id).catch(() => {});
    await supabase.auth.signOut().catch(() => {});
    return back("none");
  }

  // Students sign in with a PIN, and a switched-off account stays off.
  if (profile.role === "student") {
    await supabase.auth.signOut().catch(() => {});
    return back("student");
  }
  if (profile.active === false) {
    await supabase.auth.signOut().catch(() => {});
    return back("off");
  }

  return NextResponse.redirect(`${origin}${homeOf(profile.role)}`);
}
