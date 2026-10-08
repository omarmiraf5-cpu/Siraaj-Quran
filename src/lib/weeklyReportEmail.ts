import "server-only";

import { emailButton, emailLayout, escapeHtml } from "@/lib/email";
import { SALAM } from "@/lib/schoolWelcome";
import { SITE_URL } from "@/lib/site";
import { weekLabel, type StudentWeek, type WeekRange } from "@/lib/weeklyReport";

// The two weekly emails: a parent's, about the week their children had,
// and the office's, about the school's. Plain words, what was recorded and
// nothing more — no scores invented, no child compared with another.

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MAX_LINES = 6;

/** A child's week as lines of text: each a label and what it says. */
export function childLines(c: StudentWeek): Array<{ label: string; lines: string[] }> {
  const out: Array<{ label: string; lines: string[] }> = [];
  const a = c.attendance;
  const came = a.present + a.late;
  if (came + a.absent + a.excused > 0) {
    const bits = [`came ${plural(came, "day")}${a.late ? ` (${a.late} late)` : ""}`];
    if (a.absent) bits.push(`absent ${plural(a.absent, "day")}`);
    if (a.excused) bits.push(`excused ${plural(a.excused, "day")}`);
    out.push({ label: "Attendance", lines: [bits.join(", ").replace(/^./, (x) => x.toUpperCase())] });
  }
  if (c.recitations.length) {
    const shown = c.recitations.slice(0, MAX_LINES).map((r) => [r.range, r.portion, r.rating].filter(Boolean).join(" — "));
    if (c.recitations.length > MAX_LINES) shown.push(`and ${c.recitations.length - MAX_LINES} more`);
    out.push({ label: `Qur'an · recited ${plural(c.recitations.length, "time")}`, lines: shown });
  }
  if (c.note) out.push({ label: "Their teacher's note", lines: [`“${c.note}”`] });
  if (c.qaidah) {
    const bits: string[] = [];
    if (c.qaidah.passed.length) bits.push(`passed ${c.qaidah.passed.length === 1 ? "lesson" : "lessons"} ${list(c.qaidah.passed.map(String))}`);
    if (c.qaidah.now) bits.push(`now on lesson ${c.qaidah.now.lesson}${c.qaidah.now.title ? `, ${c.qaidah.now.title}` : ""}`);
    out.push({ label: c.qaidah.book, lines: [bits.join(" · ").replace(/^./, (x) => x.toUpperCase()) || "Working through the lessons"] });
  }
  if (c.classWork.length) {
    out.push({
      label: "Class work",
      lines: c.classWork.slice(0, MAX_LINES).map((w) =>
        `${w.subject} — ${w.title}: ${w.status === "graded" && w.score != null ? `${w.score} / ${w.max}` : "handed in, waiting to be marked"}`
      ),
    });
  }
  if (c.stars.length || c.badges.length) {
    const lines: string[] = [];
    if (c.stars.length) lines.push(`${plural(c.stars.length, "star")}: ${list([...new Set(c.stars)])}`);
    for (const b of c.badges) lines.push(`New badge: ${b}`);
    out.push({ label: "From their teacher", lines });
  }
  if (c.alerts.length) {
    out.push({ label: "Their yearly plan", lines: [...c.alerts.map((x) => `${x} — their teacher can tell you more.`)] });
  }
  return out;
}

const para = "margin:6px 0 0;font-size:15px;line-height:1.55;color:#1f2430;";
const small = "margin:6px 0 0;font-size:13px;line-height:1.5;color:#6b6f7a;";
const footer = `MyDiiwaan · <a href="${SITE_URL}" style="color:#8a8d96;">mydiiwaan.com</a> · <a href="${SITE_URL}/privacy" style="color:#8a8d96;">Privacy</a>`;

/** A parent's Friday email: each of their children's week, one after another. */
export function parentWeeklyEmail(args: { parentName: string; children: StudentWeek[]; schoolName: string; range: WeekRange }) {
  const school = args.schoolName.replace(/\s+/g, " ").trim();
  const names = list(args.children.map((c) => firstName(c.name)));
  const week = weekLabel(args.range);
  const greeting = firstName(args.parentName) ? `${SALAM}, ${firstName(args.parentName)},` : `${SALAM},`;
  const intro = `Here's what ${names}'s teachers at ${school} recorded this week, ${week}.`;
  const why = `You get this each Friday when there's learning to report. Replies go to ${school}, and they can switch these emails off.`;

  const text = [
    greeting,
    "",
    intro,
    ...args.children.flatMap((c) => [
      "",
      `${c.name.toUpperCase()}${c.place ? ` · ${c.place}` : ""}`,
      ...childLines(c).flatMap((s) => [`${s.label}:`, ...s.lines.map((l) => `  • ${l}`)]),
    ]),
    "",
    `See more in MyDiiwaan: ${SITE_URL}/login`,
    "",
    why,
    "",
    "Wassalamu alaikum wa rahmatullahi wa barakatuh,",
    "The MyDiiwaan team",
  ].join("\n");

  const childHtml = (c: StudentWeek) => `<tr><td style="padding:18px 28px 0;">
    <div style="border:1px solid #ece6d8;border-radius:12px;padding:16px 18px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#0e2347;">${escapeHtml(c.name)}</div>
      ${c.place ? `<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a08a4f;margin-top:2px;">${escapeHtml(c.place)}</div>` : ""}
      ${childLines(c)
        .map(
          (s) => `<div style="margin-top:12px;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#6b6f7a;">${escapeHtml(s.label)}</div>
      ${s.lines.map((l) => `<div style="font-size:14.5px;line-height:1.5;color:#1f2430;margin-top:2px;">${escapeHtml(l)}</div>`).join("")}`
        )
        .join("")}
    </div>
  </td></tr>`;

  const html = emailLayout({
    eyebrow: "This week",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">${escapeHtml(names)}'s week</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">${escapeHtml(intro)}</p>
  </td></tr>
  ${args.children.map(childHtml).join("")}
  <tr><td style="padding:22px 28px 28px;">
    <div>${emailButton(`${SITE_URL}/login`, "See more in MyDiiwaan")}</div>
    <p style="${small}margin-top:16px;">${escapeHtml(why)}</p>
    <p style="${para}margin-top:14px;">Wassalamu alaikum wa rahmatullahi wa barakatuh,<br>The MyDiiwaan team</p>
  </td></tr>`,
    footer,
  });

  return { subject: `${names}'s week — ${week}`, html, text };
}

/** The office's Friday email: how many were reported on, and who needs a look. */
export function officeWeeklyEmail(args: { adminName: string; schoolName: string; range: WeekRange; students: StudentWeek[]; parentsEmailed: number }) {
  const school = args.schoolName.replace(/\s+/g, " ").trim();
  const week = weekLabel(args.range);
  const reported = args.students.filter((s) => !s.skipped);
  const nothing = args.students.filter((s) => s.skipped === "nothing_recorded").length;
  const off = args.students.filter((s) => s.skipped === "switched_off").length;
  const behind = reported.filter((s) => s.alerts.length).map((s) => `${s.name}${s.place ? ` (${s.place})` : ""} — ${s.alerts[0].toLowerCase()}`);
  const absent = args.students
    .filter((s) => s.attendance.absent >= 2)
    .map((s) => `${s.name}${s.place ? ` (${s.place})` : ""} — absent ${s.attendance.absent} days`);
  const greeting = firstName(args.adminName) ? `${SALAM}, ${firstName(args.adminName)},` : `${SALAM},`;

  const counts = [
    `${plural(reported.length, "student")} had learning recorded, and ${plural(args.parentsEmailed, "parent")} ${args.parentsEmailed === 1 ? "was" : "were"} sent their report.`,
    `${plural(nothing, "student")} had nothing recorded beyond attendance, so no report.`,
    ...(off ? [`${plural(off, "student")} ${off === 1 ? "has" : "have"} reports switched off.`] : []),
  ];
  const sections: Array<{ label: string; lines: string[] }> = [
    ...(behind.length ? [{ label: "Behind on their yearly plan", lines: behind.slice(0, 15).concat(behind.length > 15 ? [`and ${behind.length - 15} more`] : []) }] : []),
    ...(absent.length ? [{ label: "Absent two days or more", lines: absent.slice(0, 15).concat(absent.length > 15 ? [`and ${absent.length - 15} more`] : []) }] : []),
  ];

  const text = [
    greeting,
    "",
    `${school}'s week, ${week}:`,
    ...counts.map((c) => `  • ${c}`),
    ...sections.flatMap((s) => ["", `${s.label}:`, ...s.lines.map((l) => `  • ${l}`)]),
    "",
    `The office: ${SITE_URL}/admin`,
    "",
    "The MyDiiwaan team",
  ].join("\n");

  const html = emailLayout({
    eyebrow: "The week",
    content: `<tr><td style="padding:26px 28px 4px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#0e2347;">${escapeHtml(school)}'s week</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
    <p style="${para}">${escapeHtml(week)}:</p>
    ${counts.map((c) => `<p style="${para}">• ${escapeHtml(c)}</p>`).join("")}
  </td></tr>
  ${sections
    .map(
      (s) => `<tr><td style="padding:18px 28px 0;">
    <div style="font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#6b6f7a;">${escapeHtml(s.label)}</div>
    ${s.lines.map((l) => `<div style="font-size:14.5px;line-height:1.5;color:#1f2430;margin-top:2px;">${escapeHtml(l)}</div>`).join("")}
  </td></tr>`
    )
    .join("")}
  <tr><td style="padding:22px 28px 28px;">
    <div>${emailButton(`${SITE_URL}/admin`, "Open the office")}</div>
    <p style="${small}margin-top:16px;">Sent every Friday. You can switch these reports off, for a child, a grade or the school, under Students.</p>
  </td></tr>`,
    footer,
  });

  return { subject: `The week at ${school} — ${week}`, html, text };
}
