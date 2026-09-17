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
import { LoadingNote } from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";

const MARKS: {
  status: AttendanceStatus;
  letter: string;
  on: string;
  off: string;
  dot: string;
  num: string;
}[] = [
  { status: "present", letter: "P", on: "bg-green-700 border-green-700 text-white", off: "hover:border-green-700 hover:text-green-800", dot: "bg-green-700", num: "text-green-800 dark:text-green-300" },
  { status: "late", letter: "L", on: "bg-amber-600 border-amber-600 text-white", off: "hover:border-amber-600 hover:text-amber-700", dot: "bg-amber-600", num: "text-amber-700 dark:text-amber-300" },
  { status: "absent", letter: "A", on: "bg-red-700 border-red-700 text-white", off: "hover:border-red-700 hover:text-red-800", dot: "bg-red-700", num: "text-red-800 dark:text-red-300" },
  { status: "excused", letter: "E", on: "bg-slate-600 border-slate-600 text-white", off: "hover:border-slate-600 hover:text-slate-700", dot: "bg-slate-500", num: "text-slate-700 dark:text-slate-300" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendancePage() {
  const supabase = createClient();
  const { t } = useLanguage();
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const [{ data: studentRows }, { data: attendanceRows }] = await Promise.all([
        supabase.from("students").select("id, full_name, grade, active").eq("active", true).order("full_name"),
        // Scoped to this teacher's own recorded attendance — the same rows
        // the "Teachers can manage attendance for own classes" policy
        // already limits them to, kept explicit here for clarity.
        supabase.from("attendance").select("student_id, class_date, status").eq("teacher_id", user.id),
      ]);

      setStudents(
        (studentRows ?? []).map((s) => ({
          id: s.id,
          name: s.full_name,
          halaqa: `Grade ${s.grade}`,
          active: s.active,
        }))
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

  const markAllPresent = () => {
    setSaved(false);
    setRecords(Object.fromEntries(students.map((s) => [s.id, "present" as const])));
  };

  const count = (s: AttendanceStatus) =>
    Object.values(records).filter((v) => v === s).length;
  const marked = Object.keys(records).length;
  const remaining = students.length - marked;

  const saveAttendance = async () => {
    if (isDemo) {
      setSaved(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("teacher.attendance.signedOut"));

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      // Replace today's rows rather than upsert against the unique
      // constraint: class_id is null for every row here (no halaqa
      // filtering yet), and Postgres never treats two nulls as equal for
      // uniqueness — an upsert wouldn't find today's existing rows to
      // update, it would just pile up duplicates on every re-save.
      const { error: deleteError } = await supabase
        .from("attendance")
        .delete()
        .eq("teacher_id", user.id)
        .eq("class_date", today);
      if (deleteError) throw deleteError;

      const rows = Object.entries(records).map(([student_id, status]) => ({
        student_id,
        class_date: today,
        status,
        teacher_id: user.id,
        school_id: profile?.school_id,
      }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("attendance").insert(rows);
        if (insertError) throw insertError;
      }

      setHistory((h) => {
        const next = { ...h };
        for (const [student_id, status] of Object.entries(records)) {
          const withoutToday = (next[student_id] ?? []).filter((d) => d.date !== today);
          next[student_id] = [{ date: today, status }, ...withoutToday];
        }
        return next;
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("teacher.attendance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="max-w-2xl mx-auto pt-10">
        <LoadingNote>{t("teacher.attendance.loadingRegister")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-28 space-y-4 pt-2">
      <PortalHero
        eyebrow={t("teacher.attendance.eyebrow")}
        title={t("nav.attendance")}
        meta={[
          formatDay(today),
          `${students.length} ${t("common.students")}`,
          remaining > 0 ? `${remaining} ${t("teacher.attendance.stillToMark")}` : t("teacher.attendance.everyoneMarked"),
        ]}
      />

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
          {remaining > 0 ? `${remaining} ${t("teacher.attendance.stillToMark")}` : t("teacher.attendance.everyoneMarked")}
        </p>
        <button
          onClick={markAllPresent}
          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          {t("teacher.attendance.markAllPresent")}
        </button>
      </div>

      {/* Roster */}
      <div className="card-quiet divide-y divide-surface-border overflow-hidden">
        {students.map((s) => {
          const summary = summariseAttendance(history[s.id] ?? []);
          return (
            <div key={s.id} className="flex items-center gap-3 px-3 py-3">
              <div className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-xs flex-shrink-0">
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
                      className={`w-9 h-9 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
                        active ? m.on : `border-surface-border text-ink-muted ${m.off}`
                      }`}
                    >
                      {m.letter}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
      <div className="fixed bottom-20 md:bottom-0 start-0 end-0 md:start-56 p-3 bg-surface-card border-t border-surface-border z-30">
        <button
          onClick={saveAttendance}
          disabled={marked === 0 || saving}
          className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
        >
          {saved && <IconCheck size={16} />}
          {saving
            ? t("common.saving")
            : saved
              ? t("teacher.attendance.saved")
              : marked === 0
                ? t("teacher.attendance.markToSave")
                : `${t("teacher.attendance.saveButton")} · ${count("present")} ${t("common.present").toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}
