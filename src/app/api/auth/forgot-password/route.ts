import { createAdminClient } from "@/lib/supabase/admin";
import { passwordResetLink, sendPasswordReset } from "@/lib/passwordReset";
import { after, NextRequest, NextResponse } from "next/server";

// However often the form is sent, one reset email per account per minute.
const RESEND_AFTER_MS = 60_000;

// "Forgot your password?" Answers the same way, straight away, whether or
// not the address has an account: the lookup, the reset token and the email
// all happen after the response, so neither the wording nor the timing
// tells a stranger which addresses are signed up.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Enter the email address you sign in with." }, { status: 400 });
  }
  after(() => sendResetIfAllowed(email));
  return NextResponse.json({ ok: true });
}

async function sendResetIfAllowed(email: string) {
  try {
    const admin = createAdminClient();

    // Admins, teachers and parents only. A student signs in with a PIN on a
    // made-up address, and their teacher sets a new one.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (!profile || profile.role === "student") return;

    // Stamped in app_metadata, which only the service role can write, so the
    // limit can't be reset from a browser.
    const { data: found } = await admin.auth.admin.getUserById(profile.id);
    if (!found?.user) return;
    const lastSent = Date.parse(String(found.user.app_metadata?.password_reset_sent_at ?? ""));
    if (Date.now() - lastSent < RESEND_AFTER_MS) return;

    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    const tokenHash = link?.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error("Password reset: no reset token for this account:", error?.message ?? "none returned");
      return;
    }
    await admin.auth.admin.updateUserById(profile.id, {
      app_metadata: { password_reset_sent_at: new Date().toISOString() },
    });
    await sendPasswordReset({ name: profile.full_name ?? "", email, link: passwordResetLink(tokenHash) });
  } catch (error) {
    console.error("Password reset failed:", error);
  }
}
