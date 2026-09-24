import "server-only";

import { NEW_SCHOOL_ALERT_EMAIL, SITE_URL } from "@/lib/site";

/** What the owner is told about a school that has just finished signing up. */
export interface NewSchool {
  name: string;
  city: string;
  province: string;
  adminName: string;
  adminEmail: string;
  halaqas: number;
  teachers: number;
  students: number;
  parents: number;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The email itself: a subject, an HTML body and a plain-text one. Every
 * value comes from the signup form, so all of it is escaped. Passwords and
 * student PINs are never in it, only names and head counts.
 */
export function newSchoolAlertEmail(school: NewSchool) {
  const name = school.name.replace(/\s+/g, " ").trim();
  const place = [school.city, school.province].map((s) => s.trim()).filter(Boolean).join(", ");
  const dashboard = `${SITE_URL}/platform`;
  const rows: Array<[string, string]> = [
    ["Admin", school.adminName.trim()],
    ["Email", school.adminEmail],
    ["Halaqas", String(school.halaqas)],
    ["Teachers", String(school.teachers)],
    ["Students", String(school.students)],
    ["Parents", String(school.parents)],
  ];
  const firstName = school.adminName.trim().split(/\s+/)[0] || "them";

  const text = [
    `${name} has just signed up to MyDiiwaan.`,
    "",
    ...(place ? [`Location:  ${place}`] : []),
    ...rows.map(([label, value]) => `${`${label}:`.padEnd(10)} ${value}`),
    "",
    `Reply to this email to write to ${firstName} directly.`,
    "",
    `All schools: ${dashboard}`,
  ].join("\n");

  const cell = "padding:10px 0;border-bottom:1px solid #e8e4da;font-size:15px;";
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
  <tr><td style="background:#0e2347;padding:22px 28px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#ffffff;">My<span style="color:#d9bd74;">Diiwaan</span></div>
    <div style="margin-top:4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d9bd74;">New school</div>
  </td></tr>
  <tr><td style="padding:26px 28px 8px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">${escapeHtml(name)} has just signed up</div>
    ${place ? `<div style="margin-top:6px;font-size:15px;color:#6b6f7a;">${escapeHtml(place)}</div>` : ""}
  </td></tr>
  <tr><td style="padding:8px 28px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="${cell}color:#6b6f7a;width:110px;">${label}</td><td style="${cell}font-weight:600;">${
              label === "Email"
                ? `<a href="mailto:${escapeHtml(value)}" style="color:#0e2347;">${escapeHtml(value)}</a>`
                : escapeHtml(value)
            }</td></tr>`
        )
        .join("\n      ")}
    </table>
  </td></tr>
  <tr><td style="padding:18px 28px 6px;font-size:15px;line-height:1.5;color:#1f2430;">
    Reply to this email to write to ${escapeHtml(firstName)} directly.
  </td></tr>
  <tr><td style="padding:14px 28px 28px;">
    <a href="${dashboard}" style="display:inline-block;background:#0e2347;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">See all schools</a>
  </td></tr>
</table>
<div style="max-width:520px;margin-top:14px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#8a8d96;">Sent by MyDiiwaan whenever a school finishes signing up.</div>
</td></tr>
</table>
</body></html>`;

  return { subject: `New school on MyDiiwaan: ${name}`, html, text };
}

/**
 * Emails the owner that a school has signed up, through Resend's API.
 *
 * Runs once the school already exists, so it never throws: a missing
 * RESEND_API_KEY, Resend being down or rejecting the request, even a bug
 * in here — each is logged, and none of them can reach the admin who just
 * signed up or undo what was created for them.
 */
export async function sendNewSchoolAlert(school: NewSchool): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(`New school "${school.name}" signed up; no email sent because RESEND_API_KEY isn't set.`);
      return;
    }
    const email = newSchoolAlertEmail(school);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend's shared sender works before any domain is verified with
        // them — but only to the account's own address, which is why the
        // recipient lives in site.ts next to a note saying so.
        from: "MyDiiwaan <onboarding@resend.dev>",
        to: [NEW_SCHOOL_ALERT_EMAIL],
        reply_to: school.adminEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`New-school email for "${school.name}" was refused: ${response.status} ${await response.text()}`);
    }
  } catch (error) {
    console.error(`New-school email for "${school.name}" failed:`, error);
  }
}
