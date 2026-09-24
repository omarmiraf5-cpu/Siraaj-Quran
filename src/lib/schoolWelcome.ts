import "server-only";

import { emailButton, emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
import { EMAIL_FROM, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

/** The school a new admin has just finished setting up. */
export interface WelcomedSchool {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  halaqas: number;
  teachers: number;
  students: number;
  parents: number;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The new admin's welcome: where they sign in, the link their students
 * need, and how teachers and parents get in. Never a password or PIN —
 * those were on the screen the admin has just seen, and the admin portal
 * can reset any of them.
 *
 * The subject is fixed rather than naming the school: the name is whatever
 * was typed into a public form, and this goes to whatever address was typed
 * next to it.
 */
export function schoolWelcomeEmail(school: WelcomedSchool) {
  const name = school.name.replace(/\s+/g, " ").trim();
  const firstName = school.adminName.trim().split(/\s+/)[0];
  const greeting = firstName ? `Assalamu alaikum ${firstName},` : "Assalamu alaikum,";
  const loginUrl = `${SITE_URL}/login`;
  const studentUrl = `${SITE_URL}/login?school=${encodeURIComponent(school.slug)}`;
  const hasAdults = school.teachers + school.parents > 0;
  const setUp = [
    school.halaqas > 0 && count(school.halaqas, "halaqa", "halaqas"),
    school.teachers > 0 && count(school.teachers, "teacher", "teachers"),
    school.students > 0 && count(school.students, "student", "students"),
    school.parents > 0 && count(school.parents, "parent", "parents"),
  ]
    .filter(Boolean)
    .join(" · ");

  const adultsLine =
    "They sign in at the same address with their email and the temporary password shown when you finished signing up, then choose their own password.";
  const resetLine =
    "Lost a password or PIN? You can reset teacher and parent passwords, and set student PINs, any time from your admin portal.";

  const text = [
    greeting,
    "",
    `${name} is set up on MyDiiwaan. Here's how everyone signs in.`,
    "",
    "YOU",
    `Sign in at ${loginUrl} with ${school.adminEmail} and the password you chose.`,
    "",
    "STUDENTS",
    "Give your students this link. It shows them your school's names to tap, then they enter their PIN:",
    studentUrl,
    ...(hasAdults ? ["", "TEACHERS AND PARENTS", adultsLine] : []),
    "",
    ...(setUp ? [`You set up ${setUp}.`, ""] : []),
    resetLine,
    "",
    "Questions? Just reply to this email.",
    "",
    "MyDiiwaan",
  ].join("\n");

  const label = "font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9a7a2a;";
  const para = "margin:6px 0 0;font-size:15px;line-height:1.55;color:#1f2430;";
  const html = emailLayout({
    eyebrow: "Welcome",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">${escapeHtml(name)} is ready</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">Your school is set up on MyDiiwaan. Here's how everyone signs in.</p>
  </td></tr>
  <tr><td style="padding:22px 28px 0;">
    <div style="${label}">You</div>
    <p style="${para}">Sign in with <strong>${escapeHtml(school.adminEmail)}</strong> and the password you chose.</p>
    <div style="margin-top:14px;">${emailButton(loginUrl, "Sign in to MyDiiwaan")}</div>
  </td></tr>
  <tr><td style="padding:24px 28px 0;">
    <div style="${label}">Students</div>
    <p style="${para}">Give your students this link. It shows them your school's names to tap, then they enter their PIN.</p>
    <div style="margin-top:10px;background:#eef0f8;border-radius:10px;padding:12px 14px;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.4;word-break:break-all;"><a href="${studentUrl}" style="color:#0e2347;">${studentUrl}</a></div>
  </td></tr>
  ${
    hasAdults
      ? `<tr><td style="padding:24px 28px 0;">
    <div style="${label}">Teachers and parents</div>
    <p style="${para}">${adultsLine}</p>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:24px 28px 28px;">
    ${setUp ? `<p style="${para}color:#6b6f7a;">You set up ${setUp}.</p>` : ""}
    <p style="${para}">${resetLine}</p>
    <p style="${para}">Questions? Just reply to this email.</p>
  </td></tr>`,
    footer: `MyDiiwaan · <a href="${SITE_URL}" style="color:#8a8d96;">mydiiwaan.com</a> · <a href="${SITE_URL}/privacy" style="color:#8a8d96;">Privacy</a>`,
  });

  return { subject: "Welcome to MyDiiwaan — your school is ready", html, text };
}

/** Emails a school's new admin their welcome. Never throws (see sendEmail). */
export function sendSchoolWelcome(school: WelcomedSchool): Promise<EmailResult> {
  return sendEmail(`Welcome email for "${school.name}"`, () => ({
    from: EMAIL_FROM,
    to: school.adminEmail,
    replyTo: SUPPORT_EMAIL,
    ...schoolWelcomeEmail(school),
  }));
}
