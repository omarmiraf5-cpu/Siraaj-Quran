import { currentLanguage } from "@/lib/i18n/current";
import { phrase } from "@/lib/i18n/phrases";

/*
 * Portal notices are written in English when the server raises them
 * (api/attendance, api/staff-absence) and stored that way, one row per
 * recipient. This says a notice again in the reader's language: it reads
 * the names, counts and dates back out of each known wording. Wording it
 * doesn't recognise is shown as it was stored.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** "Sat 26 Sep", as the server writes a date, in the reader's language. */
function day(text: string): string {
  const m = text.match(/^(\w{3}) (\d{1,2}) (\w{3})$/);
  if (!m || currentLanguage() !== "ar") return text;
  const w = WEEKDAYS.indexOf(m[1]);
  const mo = MONTHS.indexOf(m[3]);
  return w < 0 || mo < 0 ? text : `${WEEKDAYS_AR[w]} ${m[2]} ${MONTHS_AR[mo]}`;
}

const REASONS = ["Sick", "Family matter", "Travelling", "Other"];

export function translateNotice<N extends { title: string; body: string }>(n: N): N {
  if (currentLanguage() === "en") return n;
  let title = n.title;
  let body = n.body;
  let m: RegExpMatchArray | null;

  if ((m = n.title.match(/^(.+) has missed (\d+) school days in a row$/))) {
    title = phrase("{name} has missed {count} school days in a row", { name: m[1], count: Number(m[2]) });
  } else if ((m = n.title.match(/^(.+): absent (\d+) school days in a row$/))) {
    title = phrase("{name}: absent {count} school days in a row", { name: m[1], count: Number(m[2]) });
  } else if ((m = n.title.match(/^(.+) finished Surah (.+)$/))) {
    title = phrase("{name} finished Surah {surah}", { name: m[1], surah: m[2] });
  } else if ((m = n.title.match(/^(.+) completed Juz' (\d+)$/))) {
    title = phrase("{name} completed Juz' {juz}", { name: m[1], juz: Number(m[2]) });
  } else if ((m = n.title.match(/^(.+) is almost halfway through Juz' (\d+)$/))) {
    title = phrase("{name} is almost halfway through Juz' {juz}", { name: m[1], juz: Number(m[2]) });
  } else if ((m = n.title.match(/^(.+) reported an absence$/))) {
    title = phrase("{name} reported an absence", { name: m[1] });
  }

  if ((m = n.body.match(/^(.+) was marked absent on (\d+) school days in a row, from (.+) to (.+)\. Please get in touch with the school to let them know what's happening\.$/))) {
    body = phrase("{name} was marked absent on {count} school days in a row, from {from} to {to}. Please get in touch with the school to let them know what's happening.", {
      name: m[1], count: Number(m[2]), from: day(m[3]), to: day(m[4]),
    });
  } else if ((m = n.body.match(/^Marked absent from (.+) to (.+?)\. (.+)$/))) {
    body = `${phrase("Marked absent from {from} to {to}.", { from: day(m[1]), to: day(m[2]) })} ${phrase(m[3])}`;
  } else if ((m = n.body.match(/^(\w{3} \d{1,2} \w{3})(?: – (\w{3} \d{1,2} \w{3}))? · ([^—]+?)(?: — (.*))?$/)) && REASONS.includes(m[3])) {
    const when = m[2] ? `${day(m[1])} – ${day(m[2])}` : day(m[1]);
    body = `${when} · ${phrase(m[3])}${m[4] ? ` — ${m[4]}` : ""}`;
  }
  const kind = (n as { kind?: string }).kind;
  if (kind === "milestone") body = phrase(n.body);
  return { ...n, title, body };
}
