import "server-only";

/** Everything interpolated into an email's HTML comes from a form. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * The frame every MyDiiwaan email shares: the navy band with the wordmark
 * and a gold eyebrow, a white card holding `content` (table rows), and a
 * line of small print under the card. Inline styles and tables only, since
 * that's what mail clients reliably render.
 */
export function emailLayout({ eyebrow, content, footer }: { eyebrow: string; content: string; footer: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:${FONT};color:#1f2430;">
  <tr><td style="background:#0e2347;padding:22px 28px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#ffffff;">My<span style="color:#d9bd74;">Diiwaan</span></div>
    <div style="margin-top:4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d9bd74;">${eyebrow}</div>
  </td></tr>
  ${content}
</table>
<div style="max-width:520px;margin-top:14px;font-family:${FONT};font-size:12px;line-height:1.5;color:#8a8d96;">${footer}</div>
</td></tr>
</table>
</body></html>`;
}

export const emailButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0e2347;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">${label}</a>`;

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends one email through Resend's API.
 *
 * Never throws. Every email MyDiiwaan sends is about something that has
 * already happened, so a missing RESEND_API_KEY, Resend being down or
 * refusing the message, even a bug in `build`, is logged under `what` (to
 * say which email it was) and handed back as a reason, for a caller that
 * has someone to show it to.
 */
export async function sendEmail(what: string, build: () => OutgoingEmail): Promise<EmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(`${what}: not sent, because RESEND_API_KEY isn't set.`);
      return { ok: false, reason: "RESEND_API_KEY isn't set on the server." };
    }
    const email = build();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`${what}: refused by Resend: ${response.status} ${body}`);
      let message = body;
      try { message = JSON.parse(body).message ?? body; } catch { /* not JSON: the raw text will do */ }
      return { ok: false, reason: `Resend refused it: ${message}` };
    }
    return { ok: true };
  } catch (error) {
    console.error(`${what}: failed:`, error);
    return { ok: false, reason: `Couldn't send it: ${error instanceof Error ? error.message : String(error)}` };
  }
}
