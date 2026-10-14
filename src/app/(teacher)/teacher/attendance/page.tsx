"use client";

import { useEffect, useState } from "react";
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
import { LoadingNote, avatarTone } from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { demoAttendanceFetch } from "@/lib/demoAttendance";
import { PlanAlertBanner } from "@/components/yearly-plan-ui";
import { myHalaqas, narrowToMine, type MyHalaqa } from "@/lib/teacherScope";

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
  { status: "present", letterKey: "common.presentLetter", on: "bg-attend-present border-attend-present text-white", off: "hover:border-attend-present hover:text-attend-present-ink", dot: "bg-attend-present", num: "text-attend-present-ink" },
  { status: "late", letterKey: "common.lateLetter", on: "bg-attend-late border-attend-late text-white", off: "hover:border-attend-late hover:text-attend-late-ink", dot: "bg-attend-late", num: "text-attend-late-ink" },
  { status: "absent", letterKey: "common.absentLetter", on: "bg-attend-absent border-attend-absent text-white", off: "hover:border-attend-absent hover:text-attend-absent-ink", dot: "bg-attend-absent", num: "text-attend-absent-ink" },
  { status: "excused", letterKey: "common.excusedLetter", on: "bg-attend-excused border-attend-excused text-white", off: "hover:border-attend-excused hover:text-attend-excused-ink", dot: "bg-attend-excused", num: "text-attend-excused-ink" },
];

/** Today on the teacher's own device — not toISOString(), which is the UTC
 *  date and turns an evening register in Edmonton into tomorrow's. */
function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

export default function TeacherAttendancePage() {
  const supabase = createClient();
  const { t, language, tr } = useLanguage();
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [today, setToday] = useState(DEMO_TODAY);
  // Starts empty rather than seeded with the demo roster: this page can
  // load into either a real teacher's session or the demo, and showing the
  // sample students first — then swapping to the real ones a moment later
  // — briefly puts one school's roster on screen inside another's session.
  // Nothing renders below until `ready`, once we actually know which one
  // this is.
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [history, setHistory] = useState<Record<string, AttendanceDay[]>>({});
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  // Today's marks as they stand in the database: what a save changes is
  // worked out against these.
  const [savedMarks, setSavedMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [longAbsences, setLongAbsences] = useState<LongAbsence[]>([]);
  // Each halaqa has its own register: one at a time on screen, its own
  // tally, "mark all present" and save. Null in the sample school.
  const [halaqas, setHalaqas] = useState<MyHalaqa[] | null>(null);
  const [halaqaId, setHalaqaId] = useState<string | null>(null);

  // Merged with whatever the admin portal has added, so a newly enrolled
  // student shows up on today's register without a page reload elsewhere.
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const roster = allStudents(
          readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
          readDemoStore(DEMO_STUDENT_OVERRIDES_KEY, {})
        ).filter((s) => s.active !== false);
        setStudents(roster);
        setHistory(DEMO_ATTENDANCE);
        return;
      }

      const todayStr = todayIso();
      setToday(todayStr);

      const [{ data: studentRows }, { data: attendanceRows }, groups] = await Promise.all([
        supabase.from("students").select("id, full_name, grade, active").eq("active", true).order("full_name"),
        // What this teacher recorded, and any marks for the children of a
        // halaqa they teach, whoever took them: the attendance policy
        // decides, so teachers sharing a halaqa see one register.
        supabase.from("attendance").select("student_id, class_date, status"),
        // Their own halaqas, each with its children.
        myHalaqas(supabase),
      ]);
      const mine = groups && new Map(groups.flatMap((h) => h.studentIds.map((id) => [id, h.label] as const)));
      const present = new Set((studentRows ?? []).map((s) => s.id as string));
      const shown = groups?.filter((h) => h.studentIds.some((id) => present.has(id))) ?? null;
      setHalaqas(shown);
      // Opened from a halaqa on the dashboard, that one; otherwise the last one used here.
      let remembered: string | null = new URLSearchParams(window.location.search).get("halaqa");
      try {
        remembered ??= localStorage.getItem("attendance_halaqa");
      } catch {}
      setHalaqaId(shown?.find((h) => h.id === remembered)?.id ?? shown?.[0]?.id ?? null);

      setStudents(
        narrowToMine(
          (studentRows ?? []).map((s) => ({
            id: s.id,
            name: s.full_name,
            halaqa: `Grade ${s.grade}`,
            active: s.active,
          })),
          mine
        )
      );

      const byStudent: Record<string, AttendanceDay[]> = {};
      const todayRecords: Record<string, AttendanceStatus> = {};
      for (const row of attendanceRows ?? []) {
        const day: AttendanceDay = { date: row.class_date, status: row.status as AttendanceStatus };
        (byStudent[row.student_id] ??= []).push(day);
        if (row.class_date === todayStr) todayRecords[row.student_id] = day.status;
      }
      setHistory(byStudent);
      setRecords(todayRecords);
      setSavedMarks(todayRecords);
    };

    load().finally(() => setReady(true));
  }, []);

  const mark = (id: string, status: AttendanceStatus) => {
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
    setSaved(false);
    setRecords((r) => ({ ...r, ...Object.fromEntries(roster.map((s) => [s.id, "present" as const])) }));
  };

  const count = (s: AttendanceStatus) =>
    Object.values(here).filter((v) => v === s).length;
  const marked = Object.keys(here).length;
  const remaining = roster.length - marked;
  const changed = roster.some((s) => unsaved(s.id));

  const saveAttendance = async () => {
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
      const body = await res.json();
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
      setSavedMarks((m) => {
        const next = Object.fromEntries(Object.entries(m).filter(([id]) => !inRoster.has(id)));
        return { ...next, ...here };
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : t("teacher.attendance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

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
          remaining > 0 ? countLabel("{count} still to mark|{count} still to mark", remaining, `${remaining} ${t("teacher.attendance.stillToMark")}`) : t("teacher.attendance.everyoneMarked"),
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
                className={`flex-shrink-0 min-h-11 rounded-2xl border px-3.5 py-2 text-start transition-all duration-200 ${
                  on ? "border-emerald-700 bg-emerald-700 text-white" : "border-surface-border bg-surface-card text-ink hover:border-emerald-700"
                }`}
              >
                <span className="block text-sm font-semibold whitespace-nowrap">
                  {h.label}
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

      {/* Today's tally */}
      <div className="grid grid-cols-4 gap-2">
        {MARKS.map((m) => (
          <div key={m.status} className="card-quiet px-3 py-3">
            <p className={`text-2xl font-bold tabular-nums leading-none ${m.num}`}>
              {count(m.status)}
            </p>
            <p className="eyebrow mt-2 flex items-center gap-1.5">
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
          className="btn btn-ghost min-h-11 px-3 text-xs text-attend-present-ink"
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
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className={`w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0 ${avatarTone(s.name)}`}>
                {initials(s.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink truncate">{s.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {s.halaqa} · {summary.rate}% {t("common.thisTerm")}
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {MARKS.map((m) => {
                  const active = records[s.id] === m.status;
                  return (
                    <button
                      key={m.status}
                      onClick={() => mark(s.id, m.status)}
                      aria-label={`${t(`common.${m.status}`)} — ${s.name}`}
                      aria-pressed={active}
                      className={`w-11 h-11 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
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
        </div>
      )}

      {/* Sticky save — clears the sidebar on desktop. On mobile it docks
          above the tab bar (bottom-20, the same clearance the layout's
          <main> already reserves for that bar) rather than at bottom-0:
          both this bar and the tab bar are `fixed bottom-0`, and since the
          tab bar renders after this one in the DOM with a higher z-index,
          it was winning the stacking fight and hiding all but a sliver of
          the button underneath it. */}
      <div className="fixed bottom-20 md:bottom-0 start-0 end-0 md:start-60 p-3 bg-surface-card border-t border-surface-border z-30">
        <button
          onClick={saveAttendance}
          disabled={(marked === 0 && !changed) || saving}
          className="btn btn-primary w-full max-w-4xl mx-auto rounded-2xl disabled:opacity-40"
        >
          {saved && <IconCheck size={16} />}
          {saving
            ? t("common.saving")
            : saved
              ? t("teacher.attendance.saved")
              : marked === 0 && !changed
                ? t("teacher.attendance.markToSave")
                : `${t("teacher.attendance.saveButton")}${halaqa && halaqas && halaqas.length > 1 ? ` · ${halaqa.label}` : ""} · ${countLabel("{count} present now|{count} present now", count("present"), `${count("present")} ${t("common.present").toLowerCase()}`)}`}
        </button>
      </div>
    </div>
  );
}
