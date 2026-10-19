"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  DEMO_TODAY,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allStudents,
  summariseAttendance,
  initials,
  formatDay,
  type AttendanceDay,
  type AttendanceStatus,
  type DemoStudent,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { IconCheck } from "@/components/icons";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { fetchAll, daysAgoIso, ATTENDANCE_WINDOW_DAYS } from "@/lib/supabase/fetchAll";
import { readCache, writeCache, patchCache } from "@/lib/pageCache";
import { LoadingNote, HalaqaTitle } from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { demoAttendanceFetch } from "@/lib/demoAttendance";
import { PlanAlertBanner } from "@/components/yearly-plan-ui";
import { myHalaqas, narrowToMine, type MyHalaqa } from "@/lib/teacherScope";
import { useToast } from "@/components/Toast";
import { PressButton } from "@/components/PressButton";

/** A child whose absences just reached a run long enough to tell home about. */
interface LongAbsence {
  student_id: string;
  name: string;
  count: number;
  parents_notified: number;
  newly_notified: boolean;
}

const MARKS: {
  status: AttendanceStatus;
  letterKey: string;
  on: string;
  off: string;
  dot: string;
  num: string;
}[] = [
  { status: "present", letterKey: "common.presentLetter", on: "bg-green-700 border-green-700 text-white", off: "hover:border-green-700 hover:text-green-800", dot: "bg-green-700", num: "text-green-800 dark:text-green-300" },
  { status: "late", letterKey: "common.lateLetter", on: "bg-amber-600 border-amber-600 text-white", off: "hover:border-amber-600 hover:text-amber-700", dot: "bg-amber-600", num: "text-amber-700 dark:text-amber-300" },
  { status: "absent", letterKey: "common.absentLetter", on: "bg-red-700 border-red-700 text-white", off: "hover:border-red-700 hover:text-red-800", dot: "bg-red-700", num: "text-red-800 dark:text-red-300" },
  { status: "excused", letterKey: "common.excusedLetter", on: "bg-slate-600 border-slate-600 text-white", off: "hover:border-slate-600 hover:text-slate-700", dot: "bg-slate-500", num: "text-slate-700 dark:text-slate-300" },
];

/** Today on the teacher's own device — not toISOString(), which is the UTC
 *  date and turns an evening register in Edmonton into tomorrow's. */
function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

/*
 * Marks not yet saved are kept on the device as they're tapped, so a
 * dropped signal, a reload or a flat battery halfway down the register
 * doesn't lose them. Kept per signed-in teacher and for one day only:
 * yesterday's leftovers are never applied to today's register.
 */
type Draft = { date: string; marks: Record<string, AttendanceStatus | null> };
const draftKey = (who: string) => `attendance_draft:${who}`;

function readDraft(who: string, date: string): Draft["marks"] | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(who)) ?? "null") as Draft | null;
    return d?.date === date && d.marks && typeof d.marks === "object" ? d.marks : null;
  } catch {
    return null;
  }
}

function writeDraft(who: string, date: string, marks: Draft["marks"]) {
  try {
    if (Object.keys(marks).length === 0) localStorage.removeItem(draftKey(who));
    else localStorage.setItem(draftKey(who), JSON.stringify({ date, marks }));
  } catch {}
}

const SNAPSHOT_KEY = "teacher-register";
interface RegisterSnapshot {
  today: string;
  students: DemoStudent[];
  history: Record<string, AttendanceDay[]>;
  savedMarks: Record<string, AttendanceStatus>;
  halaqas: MyHalaqa[] | null;
}

/** The halaqa to open: the one the dashboard linked to, else the last used here. */
function openingHalaqa(shown: MyHalaqa[] | null): string | null {
  let remembered: string | null = new URLSearchParams(window.location.search).get("halaqa");
  try {
    remembered ??= localStorage.getItem("attendance_halaqa");
  } catch {}
  return shown?.find((h) => h.id === remembered)?.id ?? shown?.[0]?.id ?? null;
}

/** Whether the browser thinks there's a connection. */
function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export default function TeacherAttendancePage() {
  const supabase = createClient();
  const { t, language, tr } = useLanguage();
  const toast = useToast();
  // Today's register as last seen, shown at once while it's read again.
  // Marking waits for the fresh copy (`fresh`) — a fraction of a second —
  // so no tap is ever made against marks another teacher has since changed.
  const seen = (() => {
    const x = readCache<RegisterSnapshot>(SNAPSHOT_KEY);
    return x && x.today === todayIso() ? x : undefined;
  })();
  const [ready, setReady] = useState(Boolean(seen));
  const [fresh, setFresh] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [today, setToday] = useState(seen?.today ?? DEMO_TODAY);
  // Starts empty rather than seeded with the demo roster: this page can
  // load into either a real teacher's session or the demo, and showing the
  // sample students first — then swapping to the real ones a moment later
  // — briefly puts one school's roster on screen inside another's session.
  // Nothing renders below until `ready`, once we actually know which one
  // this is.
  const [students, setStudents] = useState<DemoStudent[]>(seen?.students ?? []);
  const [history, setHistory] = useState<Record<string, AttendanceDay[]>>(seen?.history ?? {});
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(seen?.savedMarks ?? {});
  // Today's marks as they stand in the database: what a save changes is
  // worked out against these.
  const [savedMarks, setSavedMarks] = useState<Record<string, AttendanceStatus>>(seen?.savedMarks ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [longAbsences, setLongAbsences] = useState<LongAbsence[]>([]);
  // Each halaqa has its own register: one at a time on screen, its own
  // tally, "mark all present" and save. Null in the sample school.
  const [halaqas, setHalaqas] = useState<MyHalaqa[] | null>(seen?.halaqas ?? null);
  const [halaqaId, setHalaqaId] = useState<string | null>(() => (seen ? openingHalaqa(seen.halaqas) : null));
  // Whose register the draft on this device belongs to.
  const [who, setWho] = useState<string | null>(null);
  const [restored, setRestored] = useState(0);
  const online = useOnline();

  // Merged with whatever the admin portal has added, so a newly enrolled
  // student shows up on today's register without a page reload elsewhere.
  useEffect(() => {
    const load = async () => {
      const user = await sessionUser(supabase);

      if (!user) {
        setIsDemo(true);
        const roster = allStudents(
          readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
          readDemoStore(DEMO_STUDENT_OVERRIDES_KEY, {})
        ).filter((s) => s.active !== false);
        setStudents(roster);
        setHistory(DEMO_ATTENDANCE);
        restoreDraft("demo", DEMO_TODAY, {});
        return;
      }

      const todayStr = todayIso();
      setToday(todayStr);

      const [{ data: studentRows }, { data: attendanceRows }, groups] = await Promise.all([
        supabase.from("students").select("id, full_name, grade, active").eq("active", true).order("full_name"),
        // What this teacher recorded, and any marks for the children of a
        // halaqa they teach, whoever took them: the attendance policy
        // decides, so teachers sharing a halaqa see one register.
        // About a term of marks, every page of them: today's register and
        // each child's rate, without every mark since the school began.
        fetchAll<{ student_id: string; class_date: string; status: string }>((from, to) =>
          supabase
            .from("attendance")
            .select("student_id, class_date, status")
            .gte("class_date", daysAgoIso(ATTENDANCE_WINDOW_DAYS))
            .order("class_date", { ascending: false })
            .order("student_id")
            .range(from, to)
        )
          .then((data) => ({ data }))
          .catch(() => ({ data: [] as { student_id: string; class_date: string; status: string }[] })),
        // Their own halaqas, each with its children.
        myHalaqas(supabase),
      ]);
      const mine = groups && new Map(groups.flatMap((h) => h.studentIds.map((id) => [id, h.label] as const)));
      const present = new Set((studentRows ?? []).map((s) => s.id as string));
      const shown = groups?.filter((h) => h.studentIds.some((id) => present.has(id))) ?? null;
      setHalaqas(shown);
      setHalaqaId(openingHalaqa(shown));

      const roster = narrowToMine(
        (studentRows ?? []).map((s) => ({
          id: s.id,
          name: s.full_name,
          halaqa: `Grade ${s.grade}`,
          active: s.active,
        })),
        mine
      );
      setStudents(roster);

      const byStudent: Record<string, AttendanceDay[]> = {};
      const todayRecords: Record<string, AttendanceStatus> = {};
      for (const row of attendanceRows ?? []) {
        const day: AttendanceDay = { date: row.class_date, status: row.status as AttendanceStatus };
        (byStudent[row.student_id] ??= []).push(day);
        if (row.class_date === todayStr) todayRecords[row.student_id] = day.status;
      }
      setHistory(byStudent);
      setSavedMarks(todayRecords);
      restoreDraft(user.id, todayStr, todayRecords);
      writeCache<RegisterSnapshot>(SNAPSHOT_KEY, { today: todayStr, students: roster, history: byStudent, savedMarks: todayRecords, halaqas: shown });
    };

    // Unsaved marks from earlier today go back on the register over what
    // the database holds; a mark that matches it is no longer a change.
    const restoreDraft = (owner: string, date: string, base: Record<string, AttendanceStatus>) => {
      const draft = readDraft(owner, date) ?? {};
      const next = { ...base };
      let changes = 0;
      for (const [id, status] of Object.entries(draft)) {
        if (status === null) delete next[id];
        else next[id] = status;
        if ((base[id] ?? null) !== status) changes++;
      }
      setRecords(next);
      setRestored(changes);
      setWho(owner);
    };

    load().finally(() => {
      setReady(true);
      setFresh(true);
    });
  }, []);

  // Every change not yet saved, as it stands — kept on the device.
  const pending: Draft["marks"] = {};
  for (const id of new Set([...Object.keys(records), ...Object.keys(savedMarks)])) {
    if (records[id] !== savedMarks[id]) pending[id] = records[id] ?? null;
  }
  const pendingCount = Object.keys(pending).length;
  const pendingJson = JSON.stringify(pending);
  useEffect(() => {
    if (who) writeDraft(who, today, JSON.parse(pendingJson));
  }, [who, today, pendingJson]);

  // Closing the tab or reloading with marks unsaved asks first.
  useEffect(() => {
    if (pendingCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);

  const mark = (id: string, status: AttendanceStatus) => {
    if (!fresh) return;
    setSaved(false);
    setRecords((r) => {
      const next = { ...r };
      // Tapping the same mark again clears it, so a mis-tap is undoable.
      if (next[id] === status) delete next[id];
      else next[id] = status;
      return next;
    });
  };

  // The halaqa on screen, and its children, labelled with it.
  const halaqa = halaqas?.find((h) => h.id === halaqaId) ?? null;
  const roster = halaqa
    ? students.filter((s) => halaqa.studentIds.includes(s.id)).map((s) => ({ ...s, halaqa: halaqa.label }))
    : students;
  const inRoster = new Set(roster.map((s) => s.id));
  // Today's marks for just this halaqa, and the ones as saved.
  const here = Object.fromEntries(Object.entries(records).filter(([id]) => inRoster.has(id)));
  const savedHere = Object.fromEntries(Object.entries(savedMarks).filter(([id]) => inRoster.has(id)));
  const unsaved = (id: string) => records[id] !== savedMarks[id];

  const pickHalaqa = (id: string) => {
    setHalaqaId(id);
    setSaved(false);
    setError(null);
    setLongAbsences([]);
    try {
      localStorage.setItem("attendance_halaqa", id);
    } catch {}
  };

  const markAllPresent = () => {
    if (!fresh) return;
    setSaved(false);
    setRecords((r) => ({ ...r, ...Object.fromEntries(roster.map((s) => [s.id, "present" as const])) }));
  };

  const count = (s: AttendanceStatus) =>
    Object.values(here).filter((v) => v === s).length;
  const marked = Object.keys(here).length;
  const remaining = roster.length - marked;
  const changed = roster.some((s) => unsaved(s.id));

  const saveAttendance = async () => {
    // A register left open past midnight is still for the day it was opened:
    // ask before saving those marks under a day that has ended.
    const now = todayIso();
    if (!isDemo && now !== today && !window.confirm(tr("It's now {now}, but this register is for {today}. Save these marks for {today}?", { now: formatDay(now, language), today: formatDay(today, language) }))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Saved through the server — which also works out whether any child
      // has now been absent five school days in a row and, if so, tells
      // their parents and the office. The sample portal answers the same
      // request in the browser.
      const send = isDemo ? demoAttendanceFetch("teacher") : fetch;
      const res = await send("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only what changed since the page opened or last saved: a teacher
        // sharing the halaqa may have marked other children meanwhile.
        body: JSON.stringify({
          date: today,
          // Just this halaqa's register: another halaqa's marks wait for its own save.
          records: Object.fromEntries(Object.entries(here).filter(([id, status]) => savedHere[id] !== status)),
          cleared: Object.keys(savedHere).filter((id) => !(id in here)),
        }),
      });
      // A gateway's error page isn't JSON; it's still a failed save.
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error(t("teacher.attendance.signedOut"));
      if (!res.ok) throw new Error(body.error ?? t("teacher.attendance.saveFailed"));
      setLongAbsences(Array.isArray(body.alerts) ? body.alerts : []);

      setHistory((h) => {
        const next = { ...h };
        for (const student_id of Object.keys(savedHere)) {
          if (!(student_id in here)) next[student_id] = (next[student_id] ?? []).filter((d) => d.date !== today);
        }
        for (const [student_id, status] of Object.entries(here)) {
          const withoutToday = (next[student_id] ?? []).filter((d) => d.date !== today);
          next[student_id] = [{ date: today, status }, ...withoutToday];
        }
        return next;
      });
      const nextSaved = { ...Object.fromEntries(Object.entries(savedMarks).filter(([id]) => !inRoster.has(id))), ...here };
      setSavedMarks(nextSaved);
      // The next visit opens on what was just saved.
      patchCache<RegisterSnapshot>(SNAPSHOT_KEY, { savedMarks: nextSaved });
      setSaved(true);
      setRestored(0);
      toast.success(halaqa && halaqas && halaqas.length > 1 ? `${t("teacher.attendance.saved")} · ${halaqa.label}` : t("teacher.attendance.saved"));
    } catch (err) {
      // fetch itself failing means no connection, not a refusal: say so in
      // words, and that nothing tapped has been lost.
      const message =
        err instanceof TypeError || !navigator.onLine
          ? tr("Couldn't reach the school. Your marks are kept on this device — try again when you have signal.")
          : err instanceof Error
            ? tr(err.message)
            : t("teacher.attendance.saveFailed");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Marks tapped with no signal are saved on their own when it comes back,
  // so a teacher who walked off to find a signal doesn't have to remember to.
  const wasOffline = useRef(false);
  const saveRef = useRef(saveAttendance);
  saveRef.current = saveAttendance;
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current && changed && !saving && fresh) {
      wasOffline.current = false;
      void saveRef.current();
    }
  }, [online, changed, saving, fresh]);

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto pt-10">
        <LoadingNote>{t("teacher.attendance.loadingRegister")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-28 space-y-4 pt-2">
      <PortalHero
        eyebrow={t("teacher.attendance.eyebrow")}
        title={t("nav.attendance")}
        meta={[
          formatDay(today, language),
          ...(halaqa ? [halaqa.label] : []),
          countLabel("{count} student|{count} students", roster.length, `${roster.length} ${t("common.students")}`),
          remaining > 0
            ? { text: countLabel("{count} still to mark|{count} still to mark", remaining, `${remaining} ${t("teacher.attendance.stillToMark")}`), tone: "amber" as const }
            : { text: t("teacher.attendance.everyoneMarked"), tone: "green" as const },
        ]}
      />

      {/* One register per halaqa */}
      {halaqas && halaqas.length > 1 && (
        <div role="tablist" aria-label={t("teacher.attendance.whichHalaqa")} className="flex gap-2 overflow-x-auto pb-1">
          {halaqas.map((h) => {
            const on = h.id === halaqaId;
            const kids = h.studentIds.filter((id) => students.some((s) => s.id === id));
            const done = kids.filter((id) => id in records).length;
            const pending = kids.some((id) => unsaved(id));
            return (
              <button
                key={h.id}
                role="tab"
                aria-selected={on}
                onClick={() => pickHalaqa(h.id)}
                className={`flex-shrink-0 max-w-[85%] sm:max-w-sm rounded-2xl border px-3 py-2 text-start transition-colors ${
                  on ? "border-emerald-700 bg-emerald-700 text-white" : "border-surface-border bg-surface-card text-ink hover:border-emerald-700"
                }`}
              >
                {/* A long name (grade · campus · teacher) wraps rather than
                    running past the edge of a phone. */}
                <span className="block text-sm">
                  <HalaqaTitle label={h.label} onDark={on} />
                  {pending && <span className={`ms-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle ${on ? "bg-white" : "bg-amber-500"}`} />}
                </span>
                <span className={`block text-[11px] tabular-nums ${on ? "text-white/80" : "text-ink-muted"}`}>
                  {done}/{kids.length} {countLabel("{count} marked|{count} marked", done, t("teacher.attendance.marked"))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!online && (
        <div role="status" className="rounded-2xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/25 px-4 py-3">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">{tr("You're offline")}</p>
          <p className="text-[12px] text-amber-800 dark:text-amber-300 mt-0.5">
            {tr("Keep marking — every mark is kept on this device. Save once you have signal again.")}
          </p>
        </div>
      )}

      {restored > 0 && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-surface-border bg-surface-bg-warm px-4 py-3">
          <p className="text-[13px] text-ink-body">
            {tr("{count} unsaved mark from earlier was put back. Save to keep it.|{count} unsaved marks from earlier were put back. Save to keep them.", { count: restored })}
          </p>
          <button type="button" onClick={() => setRestored(0)} className="text-[12px] font-semibold text-ink-muted hover:text-ink flex-shrink-0">
            {tr("OK")}
          </button>
        </div>
      )}

      {/* Today's tally */}
      <div className="grid grid-cols-4 gap-2">
        {MARKS.map((m) => (
          <div key={m.status} className="card-quiet px-2 sm:px-3 py-3 min-w-0">
            <p className={`text-2xl font-bold tabular-nums leading-none ${m.num}`}>
              {count(m.status)}
            </p>
            {/* Spaced capitals don't fit a quarter of a phone in Somali
                (MAQNAA, LA FASAXAY): plain small words there. */}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-ink-muted [overflow-wrap:anywhere] sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-[0.14em]">
              <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
              {t(`common.${m.status}`)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {remaining > 0 ? countLabel("{count} still to mark|{count} still to mark", remaining, `${remaining} ${t("teacher.attendance.stillToMark")}`) : t("teacher.attendance.everyoneMarked")}
        </p>
        <button
          onClick={markAllPresent}
          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          {t("teacher.attendance.markAllPresent")}
        </button>
      </div>

      {roster.length === 0 && (
        <div className="card-quiet p-5 text-[13px] text-ink-muted">{t("teacher.attendance.noHalaqa")}</div>
      )}

      {/* Roster */}
      <div className="card-quiet divide-y divide-surface-border overflow-hidden">
        {roster.map((s) => {
          const summary = summariseAttendance(history[s.id] ?? []);
          return (
            // On a phone the four marks get their own line under the name, so
            // a long name and its details show in full.
            <div key={s.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2.5 px-3 py-3">
              <div className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-xs flex-shrink-0">
                {initials(s.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink [overflow-wrap:anywhere]">{s.name}</p>
                <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                  {s.halaqa} · {summary.rate}% {t("common.thisTerm")}
                </p>
              </div>
              <div className="flex gap-2 sm:gap-1.5 w-full sm:w-auto sm:flex-shrink-0">
                {MARKS.map((m) => {
                  const active = records[s.id] === m.status;
                  return (
                    <button
                      key={m.status}
                      onClick={() => mark(s.id, m.status)}
                      aria-label={`${t(`common.${m.status}`)} — ${s.name}`}
                      aria-pressed={active}
                      className={`flex-1 sm:flex-none h-10 sm:h-9 sm:w-9 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
                        active ? m.on : `border-surface-border text-ink-muted ${m.off}`
                      }`}
                    >
                      {t(m.letterKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {longAbsences.map((a) => (
        <PlanAlertBanner
          key={a.student_id}
          level="critical"
          title={tr("{name} has now been absent {count} school days in a row", { name: a.name, count: a.count })}
          detail={
            a.newly_notified
              ? a.parents_notified > 0
                ? tr("Their parents and the office have been sent a notice in the portal.")
                : tr("The office has been sent a notice. No parent account is linked to this student, so please call the family.")
              : tr("Their parents and the office were already notified about this run of absences.")
          }
        />
      ))}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={saveAttendance}
            disabled={saving}
            className="mt-2 text-[13px] font-semibold text-red-800 dark:text-red-200 underline underline-offset-2 disabled:opacity-50"
          >
            {tr("Try again")}
          </button>
        </div>
      )}

      {/* Sticky save — clears the sidebar on desktop. On mobile it docks
          above the tab bar (bottom-20, the same clearance the layout's
          <main> already reserves for that bar) rather than at bottom-0:
          both this bar and the tab bar are `fixed bottom-0`, and since the
          tab bar renders after this one in the DOM with a higher z-index,
          it was winning the stacking fight and hiding all but a sliver of
          the button underneath it. */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 start-0 end-0 md:start-56 p-3 bg-surface-card border-t border-surface-border z-30">
        <PressButton
          onClick={saveAttendance}
          loading={saving}
          disabled={(marked === 0 && !changed) || !online || !fresh}
          className="w-full max-w-4xl mx-auto flex items-center justify-center gap-2 gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saved && <IconCheck size={16} />}
          {!online
            ? tr("Offline — marks kept on this device")
            : saving
            ? t("common.saving")
            : saved
              ? t("teacher.attendance.saved")
              : marked === 0 && !changed
                ? t("teacher.attendance.markToSave")
                : (
                  <span>
                    {t("teacher.attendance.saveButton")}
                    {/* The halaqa is named in its tab just above; on a phone
                        it would wrap the button onto three lines. */}
                    {halaqa && halaqas && halaqas.length > 1 && <span className="hidden sm:inline"> · {halaqa.label}</span>}
                    {" · "}
                    {countLabel("{count} present now|{count} present now", count("present"), `${count("present")} ${t("common.present").toLowerCase()}`)}
                  </span>
                )}
        </PressButton>
      </div>
    </div>
  );
}
