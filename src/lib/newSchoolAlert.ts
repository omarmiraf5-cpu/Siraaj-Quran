import "server-only";

import { emailButton, emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
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
  const html = emailLayout({
    eyebrow: "New school",
    content: `<tr><td style="padding:26px 28px 8px;">
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
  <tr><td style="padding:14px 28px 28px;">${emailButton(dashboard, "See all schools")}</td></tr>`,
    footer: "Sent by MyDiiwaan whenever a school finishes signing up.",
  });

  return { subject: `New school on MyDiiwaan: ${name}`, html, text };
}

/** Emails the owner that a school has signed up. Never throws (see sendEmail). */
export function sendNewSchoolAlert(school: NewSchool): Promise<EmailResult> {
  return sendEmail(`New-school email for "${school.name}"`, () => ({
    // Resend's shared sender works before any domain is verified with
    // them — but only to the account's own address, which is why the
    // recipient lives in site.ts next to a note saying so.
    from: "MyDiiwaan <onboarding@resend.dev>",
    to: NEW_SCHOOL_ALERT_EMAIL,
    replyTo: school.adminEmail,
    ...newSchoolAlertEmail(school),
  }));
}
