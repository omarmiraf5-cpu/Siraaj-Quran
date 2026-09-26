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

const SALAM = "Assalamu alaikum wa rahmatullahi wa barakatuh";

/** A saying quoted in the welcome: the Arabic, its meaning, and where it's from. */
interface Quote {
  arabic: string;
  english: string;
  source: string;
}

// Both from Sahih al-Bukhari 5027, where al-Sulami's words follow the
// hadith he narrated. The Arabic is as al-Bukhari has it; if you change
// either, check the wording and reference against the book.
const HADITH: Quote = {
  arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  english: "The best of you are those who learn the Qur'an and teach it.",
  source: "Narrated by ‘Uthman ibn ‘Affan, may Allah be pleased with him · Sahih al-Bukhari 5027",
};
const ATHAR_INTRO =
  "Abu ‘Abd al-Rahman al-Sulami, who narrated this hadith from ‘Uthman, taught the Qur'an in Kufa for decades, from the caliphate of ‘Uthman until the days of al-Hajjaj. Of this hadith he said:";
const ATHAR: Quote = {
  arabic: "وَذَاكَ الَّذِي أَقْعَدَنِي مَقْعَدِي هَذَا",
  english: "That is what has kept me sitting in this seat of mine.",
  source: "Abu ‘Abd al-Rahman al-Sulami, may Allah have mercy on him · in the same narration, Sahih al-Bukhari 5027",
};

/** Why the work matters. Hafs's recitation came from ‘Asim by way of al-Sulami. */
const WHY = [
  "The recitation most children learn today (Hafs from ‘Asim, the recitation of the Madinah Mushaf) reached ‘Asim through this same Abu ‘Abd al-Rahman. More than thirteen centuries later, the years he gave in that seat still reach every child who reads it.",
  "When you and your teachers sit with a child and a Mushaf, you are sitting in that same seat. The surahs a child learns with you are the ones they will pray with for the rest of their life. Every ayah you help them memorise and every letter you correct stays with them, and one day, in sha Allah, they will pass it on.",
  "Our part is small: to take the registers, the assignments and the paperwork off your hands, so more of your time goes to the children and the Qur'an.",
];

const ARABIC_FONT = "'Amiri','Noto Naskh Arabic','Traditional Arabic','Geeza Pro','Times New Roman',serif";

/** Keeps the last two words together, so a wrapped line never ends on one word alone. */
const noOrphan = (s: string) => s.replace(/ (\S+)$/, "&nbsp;$1");

const quoteHtml = (q: Quote) => `<div style="margin-top:12px;border-left:3px solid #d9bd74;background:#faf6ec;border-radius:0 12px 12px 0;padding:14px 18px 14px 16px;">
      <p dir="rtl" lang="ar" style="margin:0;font-family:${ARABIC_FONT};font-size:24px;line-height:1.8;color:#0e2347;text-align:right;">${noOrphan(q.arabic)}</p>
      <p style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.45;font-style:italic;color:#1f2430;">“${noOrphan(q.english)}”</p>
      <p style="margin:8px 0 0;font-size:12.5px;line-height:1.5;color:#6b6f7a;">${q.source.replace(/Sahih al-Bukhari \d+/, '<span style="white-space:nowrap;">$&</span>')}</p>
    </div>`;

const quoteText = (q: Quote) => [`  ${q.arabic}`, `  “${q.english}”`, `  (${q.source})`];

/**
 * The new admin's welcome. It opens with the salam and a word on the work
 * they've taken on (a hadith on learning and teaching the Qur'an, and what
 * the man who narrated it said of it), then says where they sign in, the
 * link their students need, and how teachers and parents get in, and ends
 * with a du'a for the school. Never a password or PIN: those were on the
 * screen the admin has just seen, and the admin portal can reset any of
 * them.
 *
 * The subject is fixed rather than naming the school: the name is whatever
 * was typed into a public form, and this goes to whatever address was typed
 * next to it.
 */
export function schoolWelcomeEmail(school: WelcomedSchool) {
  const name = school.name.replace(/\s+/g, " ").trim();
  const firstName = school.adminName.trim().split(/\s+/)[0];
  const greeting = firstName ? `${SALAM}, ${firstName},` : `${SALAM},`;
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

  const dua = `May Allah put barakah in ${name}, and make it a means of good for you, your teachers and every child who learns there.`;

  const text = [
    greeting,
    "",
    `Welcome to MyDiiwaan. ${name} is set up and ready, and it's an honour for us to be part of the work you do.`,
    "",
    "The Prophet ﷺ said:",
    "",
    ...quoteText(HADITH),
    "",
    ATHAR_INTRO,
    "",
    ...quoteText(ATHAR),
    "",
    ...WHY.flatMap((p) => [p, ""]),
    "GETTING EVERYONE SIGNED IN",
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
    dua,
    "",
    "Wassalamu alaikum wa rahmatullahi wa barakatuh,",
    "The MyDiiwaan team",
  ].join("\n");

  const label = "font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9a7a2a;";
  const para = "margin:6px 0 0;font-size:15px;line-height:1.55;color:#1f2430;";
  const html = emailLayout({
    eyebrow: "Welcome",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">${escapeHtml(name)} is ready</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">Welcome to MyDiiwaan. Your school is set up and ready, and it's an honour for us to be part of the work you do.</p>
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <p style="${para}">The Prophet ﷺ said:</p>
    ${quoteHtml(HADITH)}
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <p style="${para}">${ATHAR_INTRO}</p>
    ${quoteHtml(ATHAR)}
  </td></tr>
  <tr><td style="padding:8px 28px 0;">
    ${WHY.map((p) => `<p style="${para}margin-top:12px;">${p}</p>`).join("\n    ")}
  </td></tr>
  <tr><td style="padding:28px 28px 0;">
    <div style="border-top:1px solid #ece6d6;padding-top:22px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.3;color:#0e2347;">Getting everyone signed in</div>
  </td></tr>
  <tr><td style="padding:16px 28px 0;">
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
  <tr><td style="padding:24px 28px 0;">
    ${setUp ? `<p style="${para}color:#6b6f7a;">You set up ${setUp}.</p>` : ""}
    <p style="${para}">${resetLine}</p>
    <p style="${para}">Questions? Just reply to this email.</p>
  </td></tr>
  <tr><td style="padding:24px 28px 28px;">
    <p style="${para}">${escapeHtml(dua)}</p>
    <p style="${para}margin-top:14px;">Wassalamu alaikum wa rahmatullahi wa barakatuh,<br>The MyDiiwaan team</p>
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
