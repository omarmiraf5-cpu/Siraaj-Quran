import "server-only";

import { emailButton, emailLayout, escapeHtml, sendEmailBatch, type EmailResult } from "@/lib/email";
import { HADITH, quoteHtml, quoteText, SALAM } from "@/lib/schoolWelcome";
import { EMAIL_FROM, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";
import { makeWelcomeToken, welcomeLink, WELCOME_LINK_DAYS } from "@/lib/welcomeLink";

/** A teacher's or parent's login, just made by their school. */
export interface NewAccount {
  userId: string;
  name: string;
  email: string;
  role: "teacher" | "parent";
  /** A parent's children, as their names were entered. */
  children?: string[];
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** "Amina's", "Amina and Omar's", "Amina, Omar and Yusuf's"; "your child's" for none. */
function childrensPossessive(children: string[]): string {
  const names = children.map(firstNameOf).filter(Boolean);
  if (names.length === 0) return "your child's";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list}'s`;
}

/**
 * A new teacher's or parent's welcome, with a button to choose their own
 * password. Never the temporary password: that stays with the school, as
 * the way in if this email doesn't arrive.
 *
 * The subject is fixed rather than naming the school, as with the admin's
 * welcome: the name was typed into a public form.
 */
export function accountWelcomeEmail(args: {
  name: string;
  email: string;
  role: "teacher" | "parent";
  children?: string[];
  schoolName: string;
  link: string;
  /** Whether a reply reaches the school's office (or else MyDiiwaan). */
  repliesToSchool: boolean;
}) {
  const school = args.schoolName.replace(/\s+/g, " ").trim();
  const firstName = firstNameOf(args.name);
  const greeting = firstName ? `${SALAM}, ${firstName},` : `${SALAM},`;
  const children = args.children ?? [];
  const added = `${school} has added you to MyDiiwaan as a ${args.role}.`;
  const what =
    args.role === "teacher"
      ? "MyDiiwaan is where you'll take the register, set each child's Qur'an lessons, follow their progress and message their parents."
      : `MyDiiwaan is where you'll follow ${childrensPossessive(children)} Qur'an lessons, attendance and progress, and message their teacher.`;
  const signIn = `You'll sign in with ${args.email}. The link works once, for ${WELCOME_LINK_DAYS} days. After that, tap "Forgot your password?" on the sign-in page, or ask your school for your temporary password.`;
  const questions = args.repliesToSchool
    ? "Questions? Reply to this email and it goes to your school."
    : "Questions? Just reply to this email.";
  const dua =
    args.role === "teacher"
      ? "May Allah put barakah in your teaching."
      : `May Allah put barakah in your ${children.length > 1 ? "children's" : "child's"} learning.`;

  const text = [
    greeting,
    "",
    added,
    "",
    "The Prophet ﷺ said:",
    "",
    ...quoteText(HADITH),
    "",
    what,
    "",
    "Choose your password here:",
    args.link,
    "",
    signIn,
    "",
    questions,
    "",
    dua,
    "",
    "Wassalamu alaikum wa rahmatullahi wa barakatuh,",
    "The MyDiiwaan team",
  ].join("\n");

  const para = "margin:6px 0 0;font-size:15px;line-height:1.55;color:#1f2430;";
  const small = "margin:6px 0 0;font-size:13px;line-height:1.5;color:#6b6f7a;";
  const html = emailLayout({
    eyebrow: "Welcome",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">Welcome to ${escapeHtml(school)}</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">${escapeHtml(added)}</p>
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <p style="${para}">The Prophet ﷺ said:</p>
    ${quoteHtml(HADITH)}
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <p style="${para}">${escapeHtml(what)}</p>
    <div style="margin-top:18px;">${emailButton(args.link, "Choose your password")}</div>
    <p style="${small}margin-top:14px;">${escapeHtml(signIn)}</p>
  </td></tr>
  <tr><td style="padding:22px 28px 28px;">
    <p style="${para}">${questions}</p>
    <p style="${para}margin-top:14px;">${escapeHtml(dua)}</p>
    <p style="${para}margin-top:14px;">Wassalamu alaikum wa rahmatullahi wa barakatuh,<br>The MyDiiwaan team</p>
  </td></tr>`,
    footer: `MyDiiwaan · <a href="${SITE_URL}" style="color:#8a8d96;">mydiiwaan.com</a> · <a href="${SITE_URL}/privacy" style="color:#8a8d96;">Privacy</a>`,
  });

  return { subject: "Welcome to MyDiiwaan — choose your password", html, text };
}

/**
 * Emails each new teacher and parent their welcome, all in one go. Replies
 * go to the school's office when its address is known. Never throws (see
 * sendEmailBatch): the temporary passwords the school was given still work.
 */
export function sendAccountWelcomes(
  accounts: NewAccount[],
  school: { name: string; replyTo?: string | null }
): Promise<EmailResult> {
  if (accounts.length === 0) return Promise.resolve({ ok: true });
  const who = accounts.length === 1 ? `"${accounts[0].email}"` : `${accounts.length} accounts`;
  return sendEmailBatch(`Welcome email for ${who} at "${school.name}"`, () =>
    accounts.map((account) => ({
      from: EMAIL_FROM,
      to: account.email,
      replyTo: school.replyTo || SUPPORT_EMAIL,
      ...accountWelcomeEmail({
        ...account,
        schoolName: school.name,
        link: welcomeLink(makeWelcomeToken(account.userId)),
        repliesToSchool: Boolean(school.replyTo),
      }),
    }))
  );
}
