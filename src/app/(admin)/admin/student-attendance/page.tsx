"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEMO_ATTENDANCE,
  DEMO_HALAQAS,
  DEMO_STUDENTS,
  DEMO_TODAY,
  formatDay,
  initials,
  type AttendanceStatus,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { GRADES, gradeLabel } from "@/lib/grades";
import { loadSchoolShape, type Campus } from "@/lib/schoolStructure";
import { allRows } from "@/lib/rosterExport";
import { addDays } from "@/lib/planDates";
import { download, fileNameFor } from "@/lib/sheetTools";
import { mySchool } from "@/lib/mySchool";

// The school's student registers, for the office: how a day went halaqa by
// halaqa (and which registers haven't been taken), and each child's
// attendance over a stretch of days, most absences first. Read-only — the
// registers are taken by teachers.

interface Student {
  id: string;
  name: string;
  grade: number;
  active: boolean;
  campusId: string | null;
  halaqaId: string | null;
}
interface Halaqa {
  id: string;
  name: string;
  grade: number | null;
  campusId: string | null;
  teacher: string | null;
}
interface Mark {
  student_id: string;
  class_date: string;
  status: AttendanceStatus;
}

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const STATUS_TEXT: Record<AttendanceStatus | "none", string> = {
  present: "text-green-800 dark:text-green-300",
  late: "text-amber-700 dark:text-amber-300",
  absent: "text-red-800 dark:text-red-300",
  excused: "text-slate-600 dark:text-slate-300",
  none: "text-ink-muted",
};
type Period = "7" | "28" | "month";

const localToday = () => new Date().toLocaleDateString("en-CA");

export default function StudentAttendancePage() {
  const supabase = createClient();
  const { t, language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [today, setToday] = useState(localToday());
  const [day, setDay] = useState(localToday());
  const [period, setPeriod] = useState<Period>("28");
  const [graded, setGraded] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halaqas, setHalaqas] = useState<Halaqa[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [halaqaFilter, setHalaqaFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openHalaqa, setOpenHalaqa] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // The sample school.
        setIsDemo(true);
        setToday(DEMO_TODAY);
        setDay(DEMO_TODAY);
        setHalaqas(DEMO_HALAQAS.map((h) => ({ id: h.id, name: h.name, grade: null, campusId: null, teacher: "Ustadh Ahmed" })));
        setStudents(
          DEMO_STUDENTS.map((s) => ({
            id: s.id,
            name: s.name,
            grade: 0,
            active: true,
            campusId: null,
            halaqaId: DEMO_HALAQAS.find((h) => h.name === s.halaqa)?.id ?? null,
          }))
        );
        setMarks(Object.entries(DEMO_ATTENDANCE).flatMap(([student_id, days]) => days.map((d) => ({ student_id, class_date: d.date, status: d.status }))));
        return;
      }
      const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      const from = (() => {
        const t0 = localToday();
        const monthStart = `${t0.slice(0, 8)}01`;
        const fourWeeks = addDays(t0, -27);
        return monthStart < fourWeeks ? monthStart : fourWeeks;
      })();
      const [shape, school, studentRows, classRows, enrolments, markRows] = await Promise.all([
        loadSchoolShape(supabase, me?.school_id ?? null),
        mySchool<{ name: string }>(supabase, "name"),
        // A student's own campus, where the database has it (update 14).
        supabase
          .from("students")
          .select("id, full_name, grade, active, campus_id")
          .order("full_name")
          .limit(5000)
          .then(async (r) => (r.error ? await supabase.from("students").select("id, full_name, grade, active").order("full_name").limit(5000) : r)),
        supabase.from("classes").select("id, name, grade, campus_id, teacher_id").order("name"),
        allRows<{ student_id: string; class_id: string }>((a, b) => supabase.from("class_enrollments").select("student_id, class_id").range(a, b)),
        allRows<Mark>((a, b) =>
          supabase.from("attendance").select("student_id, class_date, status").gte("class_date", from).order("class_date").range(a, b)
        ),
      ]);
      setGraded(shape.graded);
      setCampuses(shape.campuses);
      setSchoolName(school?.name ?? "");
      const teacherIds = [...new Set((classRows.data ?? []).map((c) => c.teacher_id).filter(Boolean))] as string[];
      const { data: teacherRows } = teacherIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : { data: [] as Array<{ id: string; full_name: string }> };
      const teacherName = new Map((teacherRows ?? []).map((p) => [p.id as string, p.full_name as string]));
      const hs: Halaqa[] = (classRows.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade ?? null,
        campusId: (c.campus_id as string | null) ?? null,
        teacher: c.teacher_id ? teacherName.get(c.teacher_id) ?? null : null,
      }));
      setHalaqas(hs);
      const halaqaOf = new Map(enrolments.map((e) => [e.student_id, e.class_id]));
      setStudents(
        ((studentRows.data ?? []) as Array<{ id: string; full_name: string; grade: number; active: boolean; campus_id?: string | null }>).map((s) => {
          const h = halaqaOf.get(s.id) ?? null;
          return {
            id: s.id,
            name: s.full_name,
            grade: s.grade ?? 0,
            active: s.active !== false,
            campusId: s.campus_id ?? hs.find((x) => x.id === h)?.campusId ?? null,
            halaqaId: h,
          };
        })
      );
      setMarks(markRows);
    };
    load().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campusName = (id: string | null) => campuses.find((c) => c.id === id)?.name ?? null;
  const halaqaById = useMemo(() => new Map(halaqas.map((h) => [h.id, h])), [halaqas]);
  const halaqaLabel = (h: Halaqa, withGrade = true) =>
    [withGrade && graded && h.grade !== null ? gradeLabel(h.grade) : null, campusName(h.campusId), h.name].filter(Boolean).join(" · ");
  const placeOf = (s: Student, withGrade = true) => {
    const h = s.halaqaId ? halaqaById.get(s.halaqaId) : undefined;
    return h
      ? halaqaLabel(h, withGrade)
      : [withGrade && graded ? gradeLabel(s.grade) : null, campusName(s.campusId), "No halaqa"].filter(Boolean).join(" · ");
  };

  // Who's shown: active students matching the filters.
  const shown = students.filter(
    (s) =>
      s.active &&
      (!graded || gradeFilter === "" || s.grade === Number(gradeFilter)) &&
      (campusFilter === "" || s.campusId === campusFilter) &&
      (halaqaFilter === "" || (halaqaFilter === "none" ? !s.halaqaId : s.halaqaId === halaqaFilter)) &&
      s.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const shownIds = new Set(shown.map((s) => s.id));

  // One mark per child per day (the latest, should there be two).
  const markOn = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of marks) m.set(`${r.student_id}|${r.class_date}`, r.status);
    return m;
  }, [marks]);

  // The day.
  const dayTally = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
  let unmarked = 0;
  for (const s of shown) {
    const st = markOn.get(`${s.id}|${day}`);
    if (st) dayTally[st]++;
    else unmarked++;
  }
  const groups = [
    ...halaqas
      .map((h) => ({ key: h.id, label: halaqaLabel(h), teacher: h.teacher, kids: shown.filter((s) => s.halaqaId === h.id) }))
      .filter((g) => g.kids.length > 0),
    ...(shown.some((s) => !s.halaqaId) ? [{ key: "none", label: "No halaqa yet", teacher: null, kids: shown.filter((s) => !s.halaqaId) }] : []),
  ];

  // The stretch.
  const from = period === "7" ? addDays(today, -6) : period === "28" ? addDays(today, -27) : `${today.slice(0, 8)}01`;
  const byStudent = new Map<string, Record<AttendanceStatus, number>>();
  for (const r of marks) {
    if (r.class_date < from || r.class_date > today || !shownIds.has(r.student_id)) continue;
    const c = byStudent.get(r.student_id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    c[r.status]++;
    byStudent.set(r.student_id, c);
  }
  const rows = shown
    .map((s) => {
      const c = byStudent.get(s.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      const marked = c.present + c.late + c.absent + c.excused;
      const counted = c.present + c.late + c.absent;
      return { s, c, marked, rate: counted ? Math.round(((c.present + c.late) / counted) * 100) : null };
    })
    .sort((a, b) => b.c.absent - a.c.absent || (a.rate ?? 101) - (b.rate ?? 101) || a.s.name.localeCompare(b.s.name));
  const visibleRows = showAll ? rows : rows.slice(0, 25);
  const periodLabel = period === "7" ? "the last 7 days" : period === "28" ? "the last 4 weeks" : "this month";

  const downloadSheet = () =>
    download(fileNameFor(schoolName || "School", `student attendance ${from} to ${today}`), [
      ["Name", ...(graded ? ["Grade"] : []), "Where", "Present", "Late", "Absent", "Excused", "Attendance %"],
      ...rows.map(({ s, c, rate }) => [
        s.name,
        ...(graded ? [gradeLabel(s.grade)] : []),
        placeOf(s, false),
        String(c.present),
        String(c.late),
        String(c.absent),
        String(c.excused),
        rate === null ? "" : String(rate),
      ]),
    ]);

  const select = "bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink";
  const halaqaChoices = halaqas.filter(
    (h) => (!graded || gradeFilter === "" || h.grade === Number(gradeFilter)) && (campusFilter === "" || h.campusId === campusFilter)
  );

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto pt-10">
        <LoadingNote />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Registers"
        title={t("nav.studentAttendance")}
        meta={[formatDay(day, language), `${shown.length} students`, unmarked > 0 ? `${unmarked} not marked` : "everyone marked"]}
      />

      <div className="flex flex-wrap items-center gap-2" data-section="filters">
        {graded && (
          <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setHalaqaFilter(""); }} aria-label="Grade" className={select}>
            <option value="">Every grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        )}
        {campuses.length > 1 && (
          <select value={campusFilter} onChange={(e) => { setCampusFilter(e.target.value); setHalaqaFilter(""); }} aria-label="Campus" className={select}>
            <option value="">Every campus</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select value={halaqaFilter} onChange={(e) => setHalaqaFilter(e.target.value)} aria-label={graded ? "Teacher" : "Halaqa"} className={select}>
          <option value="">{graded ? "Every teacher" : "Every halaqa"}</option>
          {halaqaChoices.map((h) => (
            <option key={h.id} value={h.id}>
              {halaqaLabel(h)}
              {h.teacher && h.teacher !== h.name ? ` (${h.teacher})` : ""}
            </option>
          ))}
          <option value="none">{graded ? "No teacher yet" : "No halaqa yet"}</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a student…" className={`${select} flex-1 min-w-[10rem]`} />
      </div>

      {/* The day */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day" className="w-9 h-9 rounded-full border border-surface-border bg-surface-card text-ink">
          ‹
        </button>
        <div className="text-center">
          <p className="font-display text-lg font-bold text-ink leading-tight">{formatDay(day, language)}</p>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            aria-label="Day"
            className="mt-1 text-[12px] bg-transparent text-ink-muted"
          />
          {day !== today && (
            <button type="button" onClick={() => setDay(today)} className="block mx-auto text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              Back to today
            </button>
          )}
        </div>
        <button type="button" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label="Next day" className="w-9 h-9 rounded-full border border-surface-border bg-surface-card text-ink disabled:opacity-30">
          ›
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-section="day-tally">
        <StatTile value={dayTally.present} label={t("common.present")} sub="on time" />
        <StatTile value={dayTally.late} label={t("common.late")} sub="came late" />
        <StatTile value={dayTally.absent} label={t("common.absent")} sub="not in" />
        <StatTile value={dayTally.excused} label={t("common.excused")} sub="with a reason" />
        <StatTile value={unmarked} label="Not marked" sub="no register yet" />
      </div>

      <SectionCard title={graded ? "Each teacher's register" : "Each halaqa's register"} note={formatDay(day, language)}>
        {groups.length === 0 ? (
          <EmptyNote>No students match these filters.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1" data-section="registers">
            {groups.map((g) => {
              const got = g.kids.map((k) => markOn.get(`${k.id}|${day}`));
              const done = got.filter(Boolean).length;
              const count = (s: AttendanceStatus) => got.filter((x) => x === s).length;
              const isOpen = openHalaqa === g.key;
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => setOpenHalaqa(isOpen ? null : g.key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{g.label}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {g.teacher && g.teacher !== g.label.split(" · ").pop() ? `${g.teacher} · ` : ""}
                        {g.kids.length} students
                      </p>
                    </div>
                    <div className="text-end flex-shrink-0 text-[12px]">
                      {done === 0 ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">Not taken</span>
                      ) : (
                        <span className="tabular-nums">
                          <span className={STATUS_TEXT.present}>{count("present")} present</span>
                          {count("late") > 0 && <span className={STATUS_TEXT.late}> · {count("late")} late</span>}
                          {count("absent") > 0 && <span className={STATUS_TEXT.absent}> · {count("absent")} absent</span>}
                          {count("excused") > 0 && <span className={STATUS_TEXT.excused}> · {count("excused")} excused</span>}
                          {done < g.kids.length && <span className="text-ink-muted"> · {g.kids.length - done} not marked</span>}
                        </span>
                      )}
                    </div>
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm px-3 py-1 divide-y divide-surface-border">
                      {g.kids.map((k) => {
                        const st = markOn.get(`${k.id}|${day}`);
                        return (
                          <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                            <span className="text-ink truncate">{k.name}</span>
                            <span className={`font-semibold flex-shrink-0 ${STATUS_TEXT[st ?? "none"]}`}>{st ? t(`common.${st}`) : "Not marked"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* The stretch */}
      <SectionCard
        title="Each student"
        note={
          <span className="inline-flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period" className="bg-surface-card border border-surface-border rounded-lg px-2 py-1 text-[12px] text-ink normal-case tracking-normal">
              <option value="7">Last 7 days</option>
              <option value="28">Last 4 weeks</option>
              <option value="month">This month</option>
            </select>
            <button type="button" onClick={downloadSheet} className="text-[12px] font-semibold underline normal-case tracking-normal">
              Download
            </button>
          </span>
        }
      >
        {rows.length === 0 ? (
          <EmptyNote>No students match these filters.</EmptyNote>
        ) : (
          <>
            <p className="text-[12px] text-ink-muted mb-2">
              Over {periodLabel}, most absences first. Attendance % counts present and late out of the days marked (excused days aren&apos;t counted).
            </p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13px]" data-section="by-student">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="text-start font-semibold py-2 px-1">Student</th>
                    <th className="text-end font-semibold py-2 px-1">Present</th>
                    <th className="text-end font-semibold py-2 px-1">Late</th>
                    <th className="text-end font-semibold py-2 px-1">Absent</th>
                    <th className="text-end font-semibold py-2 px-1">Excused</th>
                    <th className="text-end font-semibold py-2 px-1">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {visibleRows.map(({ s, c, rate }) => (
                    <tr key={s.id}>
                      <td className="py-2 px-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            {initials(s.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink truncate">{s.name}</span>
                            <span className="block text-[11px] text-ink-muted truncate">{placeOf(s)}</span>
                          </span>
                        </span>
                      </td>
                      <td className={`py-2 px-1 text-end tabular-nums ${STATUS_TEXT.present}`}>{c.present}</td>
                      <td className={`py-2 px-1 text-end tabular-nums ${STATUS_TEXT.late}`}>{c.late}</td>
                      <td className={`py-2 px-1 text-end tabular-nums font-semibold ${c.absent > 0 ? STATUS_TEXT.absent : "text-ink-muted"}`}>{c.absent}</td>
                      <td className={`py-2 px-1 text-end tabular-nums ${STATUS_TEXT.excused}`}>{c.excused}</td>
                      <td className="py-2 px-1 text-end tabular-nums text-ink">{rate === null ? "—" : `${rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 25 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                {showAll ? "Show the first 25" : `Show all ${rows.length}`}
              </button>
            )}
          </>
        )}
      </SectionCard>
      {isDemo && <p className="text-[11px] text-ink-muted">Sample school data.</p>}
    </div>
  );
}
