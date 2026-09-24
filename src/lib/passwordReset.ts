import "server-only";

import { emailButton, emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
import { EMAIL_FROM, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

/**
 * The "reset your password" email: one button to the page where a new
 * password is chosen. The link carries a single-use token from Supabase,
 * spent only when the new password is actually submitted.
 */
export function passwordResetEmail({ name, email, link }: { name: string; email: string; link: string }) {
  const firstName = name.trim().split(/\s+/)[0];
  const greeting = firstName ? `Assalamu alaikum ${firstName},` : "Assalamu alaikum,";
  const expiry =
    "For your security, the link works only once and expires after a while. If it has expired, ask for a new one from the sign-in page.";
  const ignore = "Didn't ask for this? You can ignore this email. Your password won't change.";

  const text = [
    greeting,
    "",
    `Someone asked to reset the password for ${email} on MyDiiwaan. To choose a new one, open this link:`,
    link,
    "",
    expiry,
    "",
    ignore,
    "",
    "MyDiiwaan",
  ].join("\n");

  const para = "margin:10px 0 0;font-size:15px;line-height:1.55;color:#1f2430;";
  const html = emailLayout({
    eyebrow: "Password reset",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">Reset your password</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">Someone asked to reset the password for <strong>${escapeHtml(email)}</strong> on MyDiiwaan. Tap the button to choose a new one.</p>
    <div style="margin-top:18px;">${emailButton(link, "Choose a new password")}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 28px;">
    <p style="${para}color:#6b6f7a;">${expiry}</p>
    <p style="${para}color:#6b6f7a;">${ignore}</p>
  </td></tr>`,
    footer: `MyDiiwaan · <a href="${SITE_URL}" style="color:#8a8d96;">mydiiwaan.com</a> · <a href="${SITE_URL}/privacy" style="color:#8a8d96;">Privacy</a>`,
  });

  return { subject: "Reset your MyDiiwaan password", html, text };
}

/** Where the email's button goes: the page that takes the new password. */
export const passwordResetLink = (tokenHash: string) =>
  `${SITE_URL}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`;

/** Sends it. Never throws (see sendEmail). */
export function sendPasswordReset(args: { name: string; email: string; link: string }): Promise<EmailResult> {
  return sendEmail("Password reset email", () => ({
    from: EMAIL_FROM,
    to: args.email,
    replyTo: SUPPORT_EMAIL,
    ...passwordResetEmail(args),
  }));
}
