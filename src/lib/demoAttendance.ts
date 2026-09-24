import {
  DEMO_ATTENDANCE,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_TODAY,
  type AttendanceStatus,
} from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { addDays } from "@/lib/planDates";
import { DEFAULT_CALENDAR } from "@/lib/schoolCalendar";
import {
  ABSENCE_ALERT_DAYS,
  REASON_LABEL,
  absenceRunContaining,
  daysBetweenInclusive,
  staffDay,
  tallyStaffDays,
  type AbsenceReport,
  type RegisterStatus,
  type StaffPolicy,
  type StaffSignIn,
} from "@/lib/attendanceRules";

/**
 * Staff sign-in, absence reports and notices for the sample portal.
 *
 * Answers the same routes as the live site (/api/staff-attendance,
 * /api/staff-absence, /api/notifications, /api/attendance) from the sample
 * school kept in localStorage, using the same rules in attendanceRules.ts,
 * so the pages run their ordinary code and only swap which fetch they call.
 *
 * Two things are simulated rather than real, and the pages say so: there
 * is no phone location to check, so a sample sign-in always lands on the
 * premises; and the sample portal's clock is its own fixed morning, so a
 * sign-in reads "on time" whenever someone happens to try it.
 */

const KEY = "demo_staff_attendance_v1";
const TZ = "America/Edmonton";
/** The sample portal's "now": a little before staff are due. */
const NOW = new Date(`${DEMO_TODAY}T08:50:00-06:00`);
const SIGN_IN_AT = "08:50";
const SIGN_OUT_AT = "15:05";
const ME = DEMO_TEACHERS[0].id; // Ms. Farah — the sample teacher account.
const SAMPLE_LOCATION = { latitude: 53.5461, longitude: -113.4938 };

export type DemoRole = "teacher" | "admin" | "parent";

interface Settings {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  start_time: string;
  grace_minutes: number;
}

interface Store {
  settings: Settings;
  signIns: Array<StaffSignIn & { teacher_id: string }>;
  reports: Array<AbsenceReport & { teacher_id: string; created_at: string }>;
  /** Registers saved in the sample portal, by date then student. */
  registers: Record<string, Record<string, RegisterStatus>>;
  /** Notices a sample reader has dismissed. */
  read: string[];
}

const at = (date: string, time: string) => new Date(`${date}T${time}:00-06:00`).toISOString();

function policy(s: Settings): StaffPolicy {
  return { timeZone: TZ, startTime: s.start_time, graceMinutes: s.grace_minutes, cal: DEFAULT_CALENDAR };
}

/* ── The sample school's last four weeks ───────────────────────────── */

function seed(): Store {
  const settings: Settings = { ...SAMPLE_LOCATION, radius_m: 150, start_time: "09:00", grace_minutes: 5 };
  const days = daysBetweenInclusive(addDays(DEMO_TODAY, -27), addDays(DEMO_TODAY, -1)).filter(
    (d) => staffDay(d, undefined, [], policy(settings), NOW).status !== "off"
  );
  // Ms. Farah: reliable, late twice, off sick once — and not yet in today,
  // so whoever is trying the sample portal gets to sign her in.
  const farahLate: Record<string, string> = { "2026-07-23": "09:12", "2026-08-05": "09:08" };
  const farahOff = new Set(["2026-07-29"]);
  // Ustadh Bilal: late more often, one day missing with no word.
  const bilalLate: Record<string, string> = { "2026-07-21": "09:20", "2026-07-30": "09:11", "2026-08-10": "09:16" };
  const bilalOff = new Set(["2026-08-04"]);

  const signIns: Store["signIns"] = [];
  days.forEach((d, i) => {
    if (!farahOff.has(d)) {
      signIns.push({
        teacher_id: "t1",
        work_date: d,
        signed_in_at: at(d, farahLate[d] ?? `08:${String(40 + (i % 9)).padStart(2, "0")}`),
        signed_out_at: at(d, `15:${String(2 + (i % 6)).padStart(2, "0")}`),
        override_status: null,
      });
    }
    if (!bilalOff.has(d)) {
      signIns.push({
        teacher_id: "t2",
        work_date: d,
        signed_in_at: at(d, bilalLate[d] ?? `08:${String(48 + (i % 7)).padStart(2, "0")}`),
        signed_out_at: at(d, `15:${String(10 + (i % 5)).padStart(2, "0")}`),
        override_status: null,
      });
    }
  });

  return {
    settings,
    signIns,
    reports: [
      {
        id: "demo-report-1", teacher_id: "t1", from_date: "2026-07-29", to_date: "2026-07-29",
        reason: "sick", note: "Fever — back tomorrow insha'Allah", cancelled_at: null, created_at: at("2026-07-29", "07:10"),
      },
      {
        id: "demo-report-2", teacher_id: "t2", from_date: "2026-08-17", to_date: "2026-08-18",
        reason: "family", note: "My sister's wedding", cancelled_at: null, created_at: at("2026-08-11", "18:30"),
      },
    ],
    registers: {},
    read: [],
  };
}

function load(): Store {
  const s = readDemoStore<Store | null>(KEY, null);
  if (s && Array.isArray(s.signIns)) return s;
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(s: Store) {
  writeDemoStore(KEY, s);
}

/* ── The student register, sample history plus anything saved here ── */

function registerRecords(store: Store, studentId: string): Array<{ date: string; status: RegisterStatus }> {
  const saved = Object.entries(store.registers)
    .filter(([, marks]) => marks[studentId])
    .map(([date, marks]) => ({ date, status: marks[studentId] }));
  const savedDates = new Set(saved.map((r) => r.date));
  const sample = (DEMO_ATTENDANCE[studentId] ?? [])
    .filter((d) => !savedDates.has(d.date))
    .map((d) => ({ date: d.date, status: d.status as AttendanceStatus as RegisterStatus }));
  return [...sample, ...saved];
}

/** Every run of five that the sample school's register holds, as the
 *  notices the live site would have sent for it. */
function longAbsences(store: Store) {
  const out: Array<{ studentId: string; name: string; count: number; from: string; to: string }> = [];
  for (const s of DEMO_STUDENTS) {
    const records = registerRecords(store, s.id);
    const seen = new Set<string>();
    for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
      const run = absenceRunContaining(records, r.date);
      if (!run || run.count < ABSENCE_ALERT_DAYS || seen.has(run.from)) continue;
      seen.add(run.from);
      out.push({ studentId: s.id, name: s.name, ...run });
    }
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

function notices(store: Store, role: DemoRole) {
  const list: Array<{ id: string; kind: string; title: string; body: string; student_id: string | null; created_at: string }> = [];
  const parentChildren = new Set(["s1", "s2"]); // The sample parent is Omar's mother.
  for (const run of longAbsences(store)) {
    const first = run.name.split(" ")[0];
    const span = `from ${short(run.from)} to ${short(run.to)}`;
    const id = `absence-run:${run.studentId}:${run.from}`;
    if (role === "parent" && parentChildren.has(run.studentId)) {
      list.push({
        id, kind: "absence_streak", student_id: run.studentId, created_at: at(run.to, "16:00"),
        title: `${first} has missed ${run.count} school days in a row`,
        body: `${run.name} was marked absent on ${run.count} school days in a row, ${span}. Please get in touch with the school to let them know what's happening.`,
      });
    }
    if (role === "admin") {
      list.push({
        id, kind: "absence_streak", student_id: run.studentId, created_at: at(run.to, "16:00"),
        title: `${run.name}: absent ${run.count} school days in a row`,
        body: `Marked absent ${span}. ${parentChildren.has(run.studentId) ? "Their parent has been notified in the portal." : "No parent account is linked to this student, so nobody at home has been told — call the family."}`,
      });
    }
  }
  if (role === "admin") {
    for (const r of store.reports.filter((x) => !x.cancelled_at && x.from_date >= DEMO_TODAY)) {
      const teacher = DEMO_TEACHERS.find((t) => t.id === r.teacher_id)?.name ?? "A teacher";
      const when = r.from_date === r.to_date ? short(r.from_date) : `${short(r.from_date)} – ${short(r.to_date)}`;
      list.push({
        id: `staff-absence:${r.id}`, kind: "staff_absence_report", student_id: null, created_at: r.created_at,
        title: `${teacher} reported an absence`,
        body: `${when} · ${REASON_LABEL[r.reason]}${r.note ? ` — "${r.note}"` : ""}`,
      });
    }
  }
  const read = new Set(store.read);
  return list
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((n) => ({ ...n, read_at: read.has(n.id) ? NOW.toISOString() : null }));
}

/* ── A stand-in for fetch ──────────────────────────────────────────── */

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function settingsPayload(s: Settings, isAdmin: boolean) {
  return {
    configured: s.latitude != null,
    radius_m: s.radius_m,
    start_time: s.start_time,
    grace_minutes: s.grace_minutes,
    time_zone: TZ,
    weekdays: DEFAULT_CALENDAR.weekdays,
    demo: true,
    ...(isAdmin ? { latitude: s.latitude, longitude: s.longitude } : {}),
  };
}

/** A fetch for the sample portal, answering as the given sample account. */
export function demoAttendanceFetch(role: DemoRole) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, "http://demo.local");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const store = load();
    const p = policy(store.settings);
    const today = DEMO_TODAY;

    switch (`${method} ${url.pathname}`) {
      case "GET /api/staff-attendance": {
        if (url.searchParams.get("scope") === "school") {
          const to = today;
          const from = addDays(to, -27);
          const days = daysBetweenInclusive(from, to);
          const teachers = DEMO_TEACHERS.map((t) => {
            const rows = store.signIns.filter((r) => r.teacher_id === t.id);
            const reports = store.reports.filter((r) => r.teacher_id === t.id);
            const byDate = new Map(rows.map((r) => [r.work_date, r]));
            const history = days.map((d) => staffDay(d, byDate.get(d), reports, p, NOW));
            return { id: t.id, name: t.name, today: staffDay(today, byDate.get(today), reports, p, NOW), days: history, tally: tallyStaffDays(history) };
          });
          return reply({
            today, from, to,
            settings: settingsPayload(store.settings, true),
            teachers,
            reports: store.reports
              .filter((r) => !r.cancelled_at && r.to_date >= from)
              .map((r) => ({ ...r, teacher_name: DEMO_TEACHERS.find((t) => t.id === r.teacher_id)?.name ?? "A teacher" })),
          });
        }
        const rows = store.signIns.filter((r) => r.teacher_id === ME);
        const reports = store.reports.filter((r) => r.teacher_id === ME);
        const byDate = new Map(rows.map((r) => [r.work_date, r]));
        const history = daysBetweenInclusive(addDays(today, -27), today).map((d) => staffDay(d, byDate.get(d), reports, p, NOW));
        const todayRow = byDate.get(today);
        return reply({
          today,
          settings: settingsPayload(store.settings, false),
          day: staffDay(today, todayRow, reports, p, NOW),
          signed_in: !!todayRow?.signed_in_at,
          signed_out: !!todayRow?.signed_out_at,
          days: history.reverse(),
          tally: tallyStaffDays(history),
          reports: reports.filter((r) => !r.cancelled_at),
        });
      }

      case "POST /api/staff-attendance": {
        const row = store.signIns.find((r) => r.teacher_id === ME && r.work_date === today);
        if (body.action === "sign_in") {
          if (row?.signed_in_at) return reply({ ok: true, already: true, message: "You already signed in today." });
          store.signIns.push({ teacher_id: ME, work_date: today, signed_in_at: at(today, SIGN_IN_AT), signed_out_at: null, override_status: null });
        } else {
          if (!row?.signed_in_at) return reply({ error: "You haven't signed in today, so there's nothing to sign out of." }, 409);
          row.signed_out_at = at(today, SIGN_OUT_AT);
        }
        save(store);
        return reply({ ok: true, distance_m: 40, at: body.action === "sign_in" ? SIGN_IN_AT : SIGN_OUT_AT });
      }

      case "PATCH /api/staff-attendance": {
        let row = store.signIns.find((r) => r.teacher_id === body.teacher_id && r.work_date === body.work_date);
        if (!row) {
          row = { teacher_id: body.teacher_id, work_date: body.work_date, signed_in_at: null, signed_out_at: null, override_status: null };
          store.signIns.push(row);
        }
        row.override_status = body.status ?? null;
        row.override_note = body.status ? (body.note || null) : null;
        save(store);
        return reply({ ok: true });
      }

      case "PATCH /api/staff-attendance/settings": {
        const s = store.settings;
        if (body.latitude !== undefined) s.latitude = Number(body.latitude);
        if (body.longitude !== undefined) s.longitude = Number(body.longitude);
        if (body.radius_m !== undefined) s.radius_m = Number(body.radius_m);
        if (body.start_time !== undefined) s.start_time = String(body.start_time);
        if (body.grace_minutes !== undefined) s.grace_minutes = Number(body.grace_minutes);
        save(store);
        return reply({ ok: true });
      }

      case "POST /api/staff-absence": {
        const from = String(body.from_date ?? "");
        const to = String(body.to_date || from);
        if (!from || !body.reason) return reply({ error: "Pick the days and a reason" }, 400);
        if (from < today) return reply({ error: "An absence can be reported from today onwards. For an earlier day, ask the office to correct it." }, 400);
        if (to < from) return reply({ error: "The last day is before the first" }, 400);
        const id = `demo-report-${Date.now().toString(36)}`;
        store.reports.push({
          id, teacher_id: ME, from_date: from, to_date: to, reason: body.reason,
          note: body.note ? String(body.note).slice(0, 500) : null, cancelled_at: null, created_at: NOW.toISOString(),
        });
        save(store);
        return reply({ ok: true, id }, 201);
      }

      case "DELETE /api/staff-absence": {
        const r = store.reports.find((x) => x.id === url.searchParams.get("id") && x.teacher_id === ME);
        if (!r) return reply({ error: "No such report" }, 404);
        if (r.from_date < today) return reply({ error: "That absence has already started — ask the office to change it" }, 409);
        r.cancelled_at = NOW.toISOString();
        save(store);
        return reply({ ok: true });
      }

      case "GET /api/notifications":
        return reply({ notifications: notices(store, role) });

      case "PATCH /api/notifications": {
        const ids = body.all ? notices(store, role).map((n) => n.id) : [String(body.id)];
        store.read = [...new Set([...store.read, ...ids])];
        save(store);
        return reply({ ok: true });
      }

      case "POST /api/attendance": {
        const date = String(body.date ?? today);
        const marks = (body.records ?? {}) as Record<string, RegisterStatus>;
        const before = new Set(longAbsences(store).map((r) => `${r.studentId}:${r.from}`));
        store.registers[date] = marks;
        save(store);
        const alerts = Object.entries(marks)
          .filter(([, s]) => s === "absent")
          .map(([sid]) => {
            const run = absenceRunContaining(registerRecords(store, sid), date);
            if (!run || run.count < ABSENCE_ALERT_DAYS) return null;
            return {
              student_id: sid,
              name: DEMO_STUDENTS.find((s) => s.id === sid)?.name ?? "A student",
              count: run.count, from: run.from, to: run.to,
              parents_notified: sid === "s1" || sid === "s2" ? 1 : 0,
              newly_notified: !before.has(`${sid}:${run.from}`),
            };
          })
          .filter(Boolean);
        return reply({ ok: true, saved: Object.keys(marks).length, alerts });
      }

      default:
        return reply({ error: `The sample portal has no ${method} ${url.pathname}` }, 404);
    }
  };
}
