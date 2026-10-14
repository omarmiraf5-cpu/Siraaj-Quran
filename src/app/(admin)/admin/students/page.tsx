"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  allStudents,
  allHalaqas,
  initials,
  type StudentOverride,
  type HalaqaOverride,
} from "@/data/demo";
import type { DemoStudent, DemoHalaqa, DemoTeacher } from "@/data/demo";
import { loadSchoolTeachers } from "@/lib/schoolTeachers";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import StudentImport from "@/components/StudentImport";
import WeeklyReportsCard from "@/components/WeeklyReportsCard";
import StudentPins from "@/components/StudentPins";
import { LongInactiveCard } from "@/components/LongInactiveCard";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { mySchool } from "@/lib/mySchool";
import { createClient } from "@/lib/supabase/client";
import { GRADES, gradeLabel } from "@/lib/grades";
import { loadSchoolShape, type Campus } from "@/lib/schoolStructure";
import { loadRoster } from "@/lib/rosterExport";
import { download, fileNameFor } from "@/lib/sheetTools";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

const bigField =
  "w-full min-h-11 bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-gold/35 transition";
const smallField =
  "w-full min-h-11 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-gold/35 transition";

export default function AdminStudentsPage() {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  // The code students type in the app (the school's slug), and whether the
  // sign-in link was just copied.
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [copied, setCopied] = useState(false);
  // Permanent deletion: which student's confirm box is open, what's been
  // typed into it, and any error from the attempt.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  // An academic school keeps its students in grades, and may have campuses.
  const [graded, setGraded] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [created, setCreated] = useState<DemoStudent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, StudentOverride>>({});

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newName, setNewName] = useState("");
  // A halaqa by its id; in the sample school, by its name.
  const [newHalaqa, setNewHalaqa] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHalaqa, setDraftHalaqa] = useState("");
  const [draftGrade, setDraftGrade] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftReport, setDraftReport] = useState(true);
  // Whether the weekly reports update has been run, so each child has a switch.
  const [reportsReady, setReportsReady] = useState(false);
  const [gradeBusy, setGradeBusy] = useState<number | null>(null);
  const [draftPin, setDraftPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinNote, setPinNote] = useState<string | null>(null);
  // The open student's PIN as it stands, so the office can read it out or change it.
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Putting a grade's students into its halaqas, several at once: which
  // grade is open for it, who's ticked, and the halaqa they're going to.
  const [assignGrade, setAssignGrade] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignNote, setAssignNote] = useState<string | null>(null);
  // The school's teachers: students can be put with one straight from here,
  // and the campus of the halaqa made for them if they have none yet.
  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [assignCampus, setAssignCampus] = useState("");
  // Whether students have a campus of their own (update 14), and a campus
  // for a new or edited student.
  const [studentCampusReady, setStudentCampusReady] = useState(false);
  const [newCampus, setNewCampus] = useState("");
  const [draftCampus, setDraftCampus] = useState("");
  const [campusBusy, setCampusBusy] = useState(false);

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const first = await supabase.from("classes").select("id, name, teacher_id, schedule, grade, campus_id").order("name");
    // Before the grades update, there's no campus to ask for.
    const { data } = first.error
      ? await supabase.from("classes").select("id, name, teacher_id, schedule, grade").order("name")
      : first;
    return ((data ?? []) as Array<{ id: string; name: string; teacher_id: string | null; schedule: string | null; grade: number; campus_id?: string | null }>).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      schedule: c.schedule ?? "",
      grade: c.grade,
      campusId: c.campus_id ?? null,
    }));
  };

  // A student's halaqa is a separate enrollment row in the real schema
  // (many-to-many), unlike the demo model's plain name field — this folds
  // it back down to one halaqa per student, by id as well as name, since a
  // name can repeat across an academic school's grades and campuses.
  const loadRealStudents = async () => {
    // Each newer column asked for only once the database has it.
    const withCampus = await supabase.from("students").select("id, full_name, active, grade, weekly_report, campus_id").order("full_name");
    setStudentCampusReady(!withCampus.error);
    const first = withCampus.error
      ? await supabase.from("students").select("id, full_name, active, grade, weekly_report").order("full_name")
      : withCampus;
    setReportsReady(!first.error);
    const { data: studentRows } = first.error
      ? await supabase.from("students").select("id, full_name, active, grade").order("full_name")
      : first;
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, class_id, classes(name)");
    // Each student's parents, by name.
    const { data: links } = await supabase.from("parent_students").select("parent_id, student_id");
    const parentIds = [...new Set((links ?? []).map((l) => l.parent_id as string))];
    const parentRows: Array<{ id: string; full_name: string }> = [];
    for (let i = 0; i < parentIds.length; i += 200) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", parentIds.slice(i, i + 200));
      parentRows.push(...((data ?? []) as Array<{ id: string; full_name: string }>));
    }
    const parentName = new Map(parentRows.map((p) => [p.id, p.full_name]));
    const parentsOf = new Map<string, string[]>();
    for (const l of links ?? []) {
      const n = parentName.get(l.parent_id as string);
      if (n) parentsOf.set(l.student_id as string, [...(parentsOf.get(l.student_id as string) ?? []), n]);
    }
    const halaqaByStudent = new Map<string, { id: string; name: string }>();
    for (const e of enrollments ?? []) {
      const className = (e as unknown as { classes: { name: string } | null }).classes?.name;
      if (className) halaqaByStudent.set(e.student_id, { id: e.class_id, name: className });
    }
    setStudents(
      ((studentRows ?? []) as Array<{ id: string; full_name: string; active: boolean; grade: number; weekly_report?: boolean; campus_id?: string | null }>).map((s) => ({
        id: s.id,
        name: s.full_name,
        halaqa: halaqaByStudent.get(s.id)?.name ?? "",
        halaqaId: halaqaByStudent.get(s.id)?.id,
        grade: s.grade,
        active: s.active,
        weeklyReport: s.weekly_report !== false,
        parentNames: parentsOf.get(s.id) ?? [],
        campusId: s.campus_id ?? null,
      }))
    );
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const c = readDemoStore<DemoStudent[]>(DEMO_CREATED_STUDENTS_KEY, []);
        const o = readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {});
        setCreated(c);
        setOverrides(o);
        setStudents(allStudents(c, o));
        setHalaqas(
          allHalaqas(
            readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
            readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
          )
        );
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      setSchoolId(profile?.school_id ?? null);
      if (profile?.school_id) {
        supabase
          .from("schools")
          .select("slug, name")
          .eq("id", profile.school_id)
          .single()
          .then(({ data }) => {
            setSchoolSlug(data?.slug ?? null);
            setSchoolName(data?.name ?? "");
          });
      }
      await Promise.all([
        loadSchoolShape(supabase, profile?.school_id ?? null).then((shape) => {
          setGraded(shape.graded);
          setCampuses(shape.campuses);
        }),
        loadRealStudents(),
        loadRealHalaqas().then(setHalaqas),
        loadSchoolTeachers(supabase, { everyAdmin: true })
          .then((t) => setTeachers(t.filter((x) => x.active !== false)))
          .catch(() => {}),
      ]);
    };
    load().finally(() => setReady(true));
  }, []);

  const campusName = (id: string | null | undefined) => campuses.find((c) => c.id === id)?.name;
  const halaqaById = (id: string) => halaqas.find((h) => h.id === id);
  // A halaqa as it reads in a grade's list: "North · Halaqa A".
  const halaqaInGrade = (h: DemoHalaqa) => [campusName(h.campusId), h.name].filter(Boolean).join(" · ");
  // The halaqas a student of this grade can be in: campus by campus.
  const halaqasFor = (grade: string) =>
    graded
      ? grade === ""
        ? []
        : halaqas
            .filter((h) => (h.grade ?? 0) === Number(grade))
            .sort((a, b) => (campusName(a.campusId) ?? "").localeCompare(campusName(b.campusId) ?? "") || a.name.localeCompare(b.name))
      : halaqas;
  const studentHalaqa = (s: DemoStudent) =>
    isDemo ? halaqas.find((h) => h.name === s.halaqa) : s.halaqaId ? halaqaById(s.halaqaId) : undefined;
  // The campus a student attends: their own, or else their halaqa's.
  const campusOfStudent = (s: DemoStudent) => s.campusId ?? studentHalaqa(s)?.campusId ?? null;
  // Students' campus set in one go (a whole school's list, or those ticked).
  const setCampusFor = async (ids: string[], campusId: string) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("students").update({ campus_id: campusId }).in("id", ids.slice(i, i + 200));
      if (error) throw error;
    }
  };

  // Every student as a spreadsheet: where they are, their PIN, their parents.
  const downloadList = async () => {
    setExporting(true);
    try {
      const roster = await loadRoster(supabase);
      const where = (h: { name: string; campusId: string | null }) => [campusName(h.campusId), h.name].filter(Boolean).join(" · ");
      const name = schoolName || (await mySchool<{ name: string }>(supabase, "name"))?.name || "";
      download(fileNameFor(name, "students"), [
        ["Name", ...(graded ? ["Grade"] : []), "Halaqa", "Active", "PIN", "Parents", "Parent emails"],
        ...roster.map((s) => [
          s.name,
          ...(graded ? [s.grade == null ? "" : gradeLabel(s.grade)] : []),
          s.halaqas.map(where).join(", "),
          s.active ? "Yes" : "No",
          s.pin ?? "",
          s.parents.map((p) => p.name).join(", "),
          s.parents.map((p) => p.email).join(", "),
        ]),
      ]);
    } finally {
      setExporting(false);
    }
  };

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || (graded ? newGrade === "" : !newHalaqa)) return;

    if (isDemo) {
      const student: DemoStudent = {
        id: `local-student-${Date.now()}`,
        name: newName.trim(),
        halaqa: halaqaById(newHalaqa)?.name ?? "",
      };
      const next = [...created, student];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_STUDENTS_KEY, next);
      setStudents(allStudents(next, overrides));
      setNewName("");
      setNewHalaqa("");
      setShowForm(false);
      return;
    }

    if (!schoolId) {
      setFormError(tr("Your account isn't linked to a school yet — contact support."));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const name = newName.trim();
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          full_name: name,
          grade: graded ? Number(newGrade) : 0,
          avatar_initials: initials(name),
          school_id: schoolId,
          ...(studentCampusReady && campuses.length > 0 ? { campus_id: halaqaById(newHalaqa)?.campusId ?? (newCampus || null) } : {}),
        })
        .select("id")
        .single();
      if (studentError) throw studentError;

      if (newHalaqa) {
        const { error: enrollError } = await supabase
          .from("class_enrollments")
          .insert({ class_id: newHalaqa, student_id: student.id });
        if (enrollError) throw enrollError;
      }

      await loadRealStudents();
      setNewName("");
      setNewHalaqa("");
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? tr(err.message) : tr("Failed to add student"));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (s: DemoStudent) => {
    setEditingId(s.id === editingId ? null : s.id);
    setDraftName(s.name);
    setDraftHalaqa(studentHalaqa(s)?.id ?? "");
    setDraftGrade(String(s.grade ?? 0));
    setDraftCampus(campusOfStudent(s) ?? "");
    setDraftActive(s.active !== false);
    setDraftReport(s.weeklyReport !== false);
    setDraftPin("");
    setPinNote(null);
    setEditError(null);
    setCurrentPin(null);
    if (!isDemo && s.id !== editingId) {
      supabase
        .from("students")
        .select("pin")
        .eq("id", s.id)
        .maybeSingle()
        .then(({ data }) => setCurrentPin((data?.pin as string | null) ?? null));
    }
  };

  const savePin = async (s: DemoStudent) => {
    setPinSaving(true);
    setPinNote(null);
    try {
      const res = await fetch("/api/admin/student-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: s.id, pin: draftPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.debug].filter(Boolean).join(" — ") || phrase("Failed to set PIN"));
      setPinNote(tr(currentPin ? "PIN changed. {name} now signs in with {pin}." : "PIN set. {name} now signs in with {pin}.", { name: s.name.split(" ")[0], pin: draftPin }));
      setCurrentPin(draftPin);
      setDraftPin("");
    } catch (err) {
      setPinNote(err instanceof Error ? tr(err.message) : tr("Failed to set PIN"));
    } finally {
      setPinSaving(false);
    }
  };

  const saveEdit = async (s: DemoStudent) => {
    if (isDemo) {
      const patch: StudentOverride = {
        name: draftName.trim() || s.name,
        halaqa: halaqaById(draftHalaqa)?.name ?? s.halaqa,
        active: draftActive,
      };
      const next = { ...overrides, [s.id]: { ...overrides[s.id], ...patch } };
      setOverrides(next);
      writeDemoStore(DEMO_STUDENT_OVERRIDES_KEY, next);
      setStudents(allStudents(created, next));
      setEditingId(null);
      return;
    }

    setEditError(null);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          full_name: draftName.trim() || s.name,
          active: draftActive,
          ...(graded ? { grade: Number(draftGrade) } : {}),
          ...(reportsReady ? { weekly_report: draftReport } : {}),
          // A halaqa's campus is its students'; without one, the campus chosen.
          ...(studentCampusReady && campuses.length > 0 ? { campus_id: halaqaById(draftHalaqa)?.campusId ?? (draftCampus || null) } : {}),
        })
        .eq("id", s.id);
      if (error) throw error;

      if (draftHalaqa !== (s.halaqaId ?? "")) {
        await supabase.from("class_enrollments").delete().eq("student_id", s.id);
        if (draftHalaqa) {
          const { error: enrollError } = await supabase
            .from("class_enrollments")
            .insert({ class_id: draftHalaqa, student_id: s.id });
          if (enrollError) throw enrollError;
        }
      }

      await loadRealStudents();
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
    }
  };

  const deleteStudent = async (s: DemoStudent) => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(s.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? phrase("Couldn't delete the student"));
      setDeletingId(null);
      setEditingId(null);
      await loadRealStudents();
    } catch (err) {
      setDeleteError(err instanceof Error ? tr(err.message) : tr("Couldn't delete the student"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      [s.name, ...(s.parentNames ?? [])].some((n) => n.toLowerCase().includes(search.trim().toLowerCase())) &&
      (!graded || gradeFilter === "" || (s.grade ?? 0) === Number(gradeFilter)) &&
      (campusFilter === "" || (campusFilter === "none" ? !campusOfStudent(s) : campusOfStudent(s) === campusFilter))
  );
  const activeCount = students.filter((s) => s.active !== false).length;
  // An academic school's students, by grade.
  const byGrade = graded
    ? GRADES.map((g) => ({ grade: g, students: filtered.filter((s) => (s.grade ?? 0) === g) })).filter((x) => x.students.length > 0)
    : null;

  // A whole grade's weekly reports, on or off at once — both campuses.
  const gradeAllOn = (grade: number) => students.filter((s) => (s.grade ?? 0) === grade).every((s) => s.weeklyReport !== false);
  const setGradeReports = async (grade: number, on: boolean) => {
    if (!schoolId) return;
    setGradeBusy(grade);
    const { error } = await supabase.from("students").update({ weekly_report: on }).eq("school_id", schoolId).eq("grade", grade);
    if (error) window.alert(tr(error.message));
    await loadRealStudents();
    setGradeBusy(null);
  };

  const startAssigning = (grade: number | null) => {
    setAssignGrade(grade);
    setPicked(new Set());
    setAssignTo("");
    setAssignCampus(campuses.some((c) => c.id === campusFilter) ? campusFilter : campuses[0]?.id ?? "");
    setAssignNote(null);
    setEditingId(null);
  };
  const togglePicked = (id: string) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // The ticked students into the chosen halaqa (or out of any): a student
  // is in one halaqa, so whatever they were in before is left.
  const teacherName = (id: string | null | undefined) => teachers.find((t) => t.id === id)?.name;
  // Choosing a teacher: their halaqa in this grade (at the chosen campus),
  // or a new one in their name when they don't have one yet.
  const halaqaForTeacher = async (teacherId: string, grade: number, atCampus?: string | null): Promise<{ id: string; label: string }> => {
    const campusId = campuses.length > 0 ? atCampus || assignCampus || campuses[0].id : null;
    const theirs = halaqasFor(String(grade)).find(
      (h) => h.teacherId === teacherId && (campuses.length === 0 || (h.campusId ?? null) === campusId)
    );
    if (theirs) return { id: theirs.id, label: halaqaInGrade(theirs) };
    const name = teacherName(teacherId) ?? "New halaqa";
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name,
        subject: "Qur'an & Hifz",
        grade,
        schedule: "",
        teacher_id: teacherId,
        school_id: schoolId,
        ...(campusId ? { campus_id: campusId } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    setHalaqas(await loadRealHalaqas());
    return { id: data.id as string, label: [campusName(campusId), name].filter(Boolean).join(" · ") };
  };

  // Students into a halaqa, a teacher's ("t:<id>", made if need be at
  // `atCampus`), or out of any ("__none"). What it says it did, for the note.
  const placeStudents = async (ids: string[], to: string, grade: number, atCampus?: string | null): Promise<string> => {
    const target = to.startsWith("t:") ? await halaqaForTeacher(to.slice(2), grade, atCampus) : null;
    const classId = target ? target.id : to;
    const { error: outError } = await supabase.from("class_enrollments").delete().in("student_id", ids);
    if (outError) throw outError;
    if (classId !== "__none") {
      const { error: inError } = await supabase
        .from("class_enrollments")
        .insert(ids.map((student_id) => ({ class_id: classId, student_id })));
      if (inError) throw inError;
    }
    // They attend their teacher's campus.
    const placedAt =
      classId !== "__none"
        ? halaqas.find((h) => h.id === classId)?.campusId ?? (target && campuses.length > 0 ? atCampus || assignCampus || campuses[0].id : null)
        : null;
    if (studentCampusReady && placedAt) await setCampusFor(ids, placedAt);
    const h = halaqaById(classId);
    const where = target ? target.label : h ? halaqaInGrade(h) : "the halaqa";
    return classId === "__none"
      ? phrase("{count} student taken away from their teacher.|{count} students taken away from their teacher.", { count: ids.length })
      : phrase("{count} student put with {where}.|{count} students put with {where}.", { count: ids.length, where });
  };

  // One student's teacher, chosen on their own row.
  const placeOne = async (s: DemoStudent, to: string, grade: number) => {
    setAssignBusy(true);
    setAssignNote(null);
    try {
      const said = await placeStudents([s.id], to || "__none", grade, campusOfStudent(s));
      await loadRealStudents();
      setAssignNote(`${s.name}: ${said.replace(/^1 student /, "")}`);
    } catch (err) {
      setAssignNote(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
    } finally {
      setAssignBusy(false);
    }
  };

  const assignPicked = async () => {
    const ids = [...picked];
    if (ids.length === 0 || !assignTo || assignGrade === null) return;
    setAssignBusy(true);
    setAssignNote(null);
    try {
      const said = await placeStudents(ids, assignTo, assignGrade, assignCampus);
      await loadRealStudents();
      setAssignNote(said);
      setPicked(new Set());
    } catch (err) {
      setAssignNote(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
    } finally {
      setAssignBusy(false);
    }
  };
  // Each grade at a glance: its students, how many still need a halaqa,
  // and its halaqas. Grades with neither are left out.
  const gradeSummary = graded
    ? GRADES.map((g) => {
        const inGrade = students.filter(
          (s) =>
            (s.grade ?? 0) === g &&
            s.active !== false &&
            (campusFilter === "" || (campusFilter === "none" ? !campusOfStudent(s) : campusOfStudent(s) === campusFilter))
        );
        return {
          grade: g,
          students: inGrade.length,
          unplaced: inGrade.filter((s) => !studentHalaqa(s)).length,
          halaqas: halaqasFor(String(g)).filter((h) => campusFilter === "" || campusFilter === "none" || h.campusId === campusFilter).length,
        };
      }).filter((x) => x.students > 0 || x.halaqas > 0)
    : [];

  const halaqaOptions = (grade: string) =>
    halaqasFor(grade).map((h) => (
      <option key={h.id} value={h.id}>
        {graded ? halaqaInGrade(h) : h.name}
      </option>
    ));

  const renderStudent = (s: DemoStudent) => {
    const isOpen = editingId === s.id;
    const inactive = s.active === false;
    const halaqa = studentHalaqa(s);
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => startEditing(s)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
        >
          <span
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
              inactive
                ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500"
                : "bg-brand-navy/10 text-brand-navy dark:text-brand-gold"
            }`}
          >
            {initials(s.name)}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold truncate ${inactive ? "text-ink-muted" : "text-ink"}`}>
              {s.name}
            </p>
            <p className="text-[11px] text-ink-muted truncate">
              {graded ? (halaqa ? halaqaInGrade(halaqa) : [campusName(s.campusId), phrase("No teacher yet")].filter(Boolean).join(" · ")) : s.halaqa}
              {s.parentNames && s.parentNames.length > 0 && <>{" "}{tr("· Parent: {names}|· Parents: {names}", { n: s.parentNames.length, names: s.parentNames.join(", ") })}</>}
            </p>
          </div>
          {!isDemo && reportsReady && s.weeklyReport === false && !inactive && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
              {tr("No weekly report")}
            </span>
          )}
          {inactive && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
              {tr("Inactive")}
            </span>
          )}
          <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
            <IconArrow size={14} />
          </span>
        </button>

        {isOpen && (
          <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Full name")}</label>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className={smallField} />
            </div>
            <div className={graded ? "grid grid-cols-2 gap-3" : ""}>
              {graded && (
                <label className="block">
                  <span className="block text-xs font-semibold text-ink mb-1.5">{tr("Grade")}</span>
                  <select
                    value={draftGrade}
                    onChange={(e) => {
                      setDraftGrade(e.target.value);
                      // A halaqa is in one grade: a new grade starts from none.
                      if (halaqaById(draftHalaqa)?.grade !== Number(e.target.value)) setDraftHalaqa("");
                    }}
                    className={smallField}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(g)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {studentCampusReady && campuses.length > 1 && (
                <label className="block">
                  <span className="block text-xs font-semibold text-ink mb-1.5">{tr("Campus")}</span>
                  <select
                    value={halaqaById(draftHalaqa)?.campusId ?? draftCampus}
                    onChange={(e) => {
                      setDraftCampus(e.target.value);
                      // Their teacher is at one campus: a new campus starts from none.
                      if (halaqaById(draftHalaqa)?.campusId && halaqaById(draftHalaqa)?.campusId !== e.target.value) setDraftHalaqa("");
                    }}
                    className={smallField}
                  >
                    <option value="">{tr("Not set")}</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-semibold text-ink mb-1.5">{graded ? tr("Teacher") : tr("Halaqa")}</span>
                <select value={draftHalaqa} onChange={(e) => setDraftHalaqa(e.target.value)} className={smallField}>
                  {(graded || !draftHalaqa) && <option value="">{graded ? tr("No teacher yet") : tr("Select a halaqa")}</option>}
                  {halaqaOptions(draftGrade)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draftActive}
                onChange={(e) => setDraftActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              {tr("Active")}
            </label>
            {!isDemo && reportsReady && (
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draftReport}
                  onChange={(e) => setDraftReport(e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5"
                />
                <span>
                  {tr("Weekly progress report")}
                  <span className="block text-[11px] text-ink-muted">
                    {tr("Their parents get one on Fridays when they've had lessons that week. Untick to leave them out.")}
                  </span>
                </span>
              </label>
            )}

            {/* A child signs in with four digits rather than an
                email, so the PIN is set here and read back to
                whoever forgets it. */}
            {!isDemo && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  {tr("Sign-in PIN")}
                  <span className="font-normal text-ink-muted">
                    {" "}· {currentPin ? <>{tr("now")}{" "}<span className="font-semibold text-ink tracking-[0.2em]">{currentPin}</span></> : tr("none yet")}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={draftPin}
                    onChange={(e) => setDraftPin(e.target.value.replace(/\D/g, ""))}
                    placeholder={currentPin ? tr("New 4-digit PIN") : tr("4 digits")}
                    className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink tracking-[0.4em] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  />
                  <button
                    type="button"
                    onClick={() => savePin(s)}
                    disabled={draftPin.length !== 4 || pinSaving}
                    className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 disabled:opacity-40 transition-colors"
                  >
                    {pinSaving ? tr("Saving…") : currentPin ? tr("Change PIN") : tr("Set PIN")}
                  </button>
                </div>
                {pinNote && <p className="text-[11px] text-ink-muted mt-1">{pinNote}</p>}
              </div>
            )}
            {editError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveEdit(s)}
                className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all"
              >
                {tr("Save")}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
              >
                {tr("Cancel")}
              </button>
            </div>

            {/* Deactivating (above) can be undone. This can't: it
                is for a family that has left and asked for the
                child's data to be removed, or a child's own
                request from their Account page. */}
            {!isDemo && (
              <div className="border-t border-surface-border pt-3">
                {deletingId !== s.id ? (
                  <button
                    type="button"
                    onClick={() => { setDeletingId(s.id); setDeleteText(""); setDeleteError(null); }}
                    className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline"
                  >
                    {tr("Delete permanently…")}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[12px] text-ink leading-relaxed">
                      {tr("This deletes {value}'s record, attendance, lessons, plans, messages and sign-in for good. To keep their history, untick Active instead. Type", { value: s.name.split(" ")[0] })}{" "}
                      <span className="font-semibold">{s.name}</span>{" "}{tr("to confirm.")}
                    </p>
                    <input
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder={s.name}
                      className="w-full bg-surface-card border border-red-300 dark:border-red-800/60 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => deleteStudent(s)}
                        disabled={deleteBusy || deleteText.trim().toLowerCase() !== s.name.trim().toLowerCase()}
                        className="btn btn-destructive text-[12.5px] disabled:opacity-40"
                      >
                        {deleteBusy ? tr("Deleting…") : tr("Delete permanently")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-2"
                      >
                        {tr("Keep")}
                      </button>
                    </div>
                    {deleteError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{deleteError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Roster")}
        title={tr("Students")}
        meta={[tr("{count} total", { count: students.length }), tr("{count} active", { count: activeCount }), tr("{count} halaqa|{count} halaqas", { count: halaqas.length })]}
      />

      {schoolSlug && (
        <div className="card-quiet p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{tr("Student sign-in")}</p>
            <p className="text-[13px] text-ink mt-1">
              {tr("School code:")}{" "}<span className="font-mono font-semibold">{schoolSlug}</span>
            </p>
            <p className="text-[11.5px] text-ink-muted mt-0.5 leading-relaxed">
              {tr("Students type this code once in the MyDiiwaan app, or open the sign-in link. Then they tap their name and enter their PIN.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const link = `${window.location.origin}/login?school=${schoolSlug}`;
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {});
            }}
            className="btn btn-secondary flex-shrink-0 text-[12.5px]"
          >
            {copied ? tr("Copied") : tr("Copy sign-in link")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("Search students or parents…")}
          className="flex-1 min-w-[180px] min-h-11 bg-surface-card border border-surface-border rounded-2xl px-4 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-gold/40 transition"
        />
        {!isDemo && (
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setShowForm(false); }}
            aria-expanded={showImport}
            className="btn btn-secondary flex-shrink-0"
          >
            {tr("Import from a spreadsheet")}
          </button>
        )}
        {!isDemo && (
          <button
            type="button"
            onClick={downloadList}
            disabled={exporting}
            className="btn btn-secondary flex-shrink-0 disabled:opacity-50"
          >
            {exporting ? tr("Getting them…") : tr("Download the list")}
          </button>
        )}
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setShowImport(false); }}
          className="btn btn-primary flex-shrink-0"
        >
          {showForm ? tr("Cancel") : tr("+ Add student")}
        </button>
      </div>

      {graded && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label={tr("Grade")}
            className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
          >
            <option value="">{tr("Every grade")}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
          {campuses.length > 0 && (
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              aria-label={tr("Campus")}
              className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
            >
              <option value="">{tr("Both campuses")}</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">{studentCampusReady ? tr("No campus yet") : tr("No teacher yet")}</option>
            </select>
          )}
        </div>
      )}

      {!isDemo && schoolId && <WeeklyReportsCard schoolId={schoolId} graded={graded} />}

      {!isDemo && schoolId && ready && <LongInactiveCard onRemoved={() => loadRealStudents()} />}

      {!isDemo && schoolId && ready && (
        <StudentPins
          schoolName={schoolName}
          refreshKey={students.length}
          placeOf={(id) => {
            const s = students.find((x) => x.id === id);
            const h = s ? studentHalaqa(s) : undefined;
            return [graded && s?.grade !== undefined ? gradeLabel(s.grade) : null, h ? halaqaInGrade(h) : null].filter(Boolean).join(" · ");
          }}
          onDone={() => loadRealStudents()}
        />
      )}

      {showImport && (
        <StudentImport
          graded={graded}
          campuses={campuses}
          halaqas={halaqas}
          schoolName={schoolName}
          onDone={() => {
            loadRealStudents();
            loadRealHalaqas().then(setHalaqas);
            loadSchoolShape(supabase, schoolId).then((shape) => setCampuses(shape.campuses));
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showForm && (
        <form onSubmit={addStudent} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">{tr("Full name *")}</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={tr("e.g. Zainab Ali")}
              className={bigField}
            />
          </div>
          <div className={graded ? "grid grid-cols-2 gap-3" : ""}>
            {graded && (
              <label className="block">
                <span className="block text-sm font-semibold text-ink mb-2">{tr("Grade *")}</span>
                <select
                  value={newGrade}
                  onChange={(e) => {
                    setNewGrade(e.target.value);
                    setNewHalaqa("");
                  }}
                  className={bigField}
                >
                  <option value="">{tr("Choose…")}</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {studentCampusReady && campuses.length > 1 && (
              <label className="block">
                <span className="block text-sm font-semibold text-ink mb-2">{tr("Campus")}</span>
                <select value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className={bigField}>
                  <option value="">{tr("Not set")}</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="block text-sm font-semibold text-ink mb-2">{graded ? tr("Teacher") : tr("Halaqa *")}</span>
              <select
                value={newHalaqa}
                onChange={(e) => setNewHalaqa(e.target.value)}
                disabled={graded && newGrade === ""}
                className={`${bigField} disabled:opacity-50`}
              >
                <option value="">{graded ? (newGrade === "" ? tr("Choose the grade first") : tr("Not yet")) : tr("Select a halaqa")}</option>
                {halaqaOptions(newGrade)}
              </select>
            </label>
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={!newName.trim() || (graded ? newGrade === "" : !newHalaqa) || saving}
            className="btn btn-primary w-full rounded-2xl disabled:opacity-40"
          >
            {saving ? tr("Adding…") : tr("Add student")}
          </button>
        </form>
      )}

      {!isDemo && ready && studentCampusReady && campuses.length > 1 && (() => {
        const noCampus = students.filter((s) => s.active !== false && !campusOfStudent(s));
        if (noCampus.length === 0) return null;
        return (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 p-4 flex flex-wrap items-center gap-3" data-section="no-campus">
            <p className="text-[13px] text-ink flex-1 min-w-[14rem]">
              {tr("{count} student has no campus yet. If they're all at one campus, put them there in one go — or set each one's campus with|{count} students have no campus yet. If they're all at one campus, put them there in one go — or set each one's campus with", { count: <strong>{noCampus.length}</strong>, n: noCampus.length })}{" "}<em>{tr("Assign to a teacher")}</em>.
            </p>
            <div className="flex flex-wrap gap-2">
              {campuses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={campusBusy}
                  onClick={async () => {
                    if (!window.confirm(tr("Put all {count} students with no campus at {name}?", { count: noCampus.length, name: c.name }))) return;
                    setCampusBusy(true);
                    try {
                      await setCampusFor(noCampus.map((s) => s.id), c.id);
                      await loadRealStudents();
                    } catch (err) {
                      window.alert(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
                    } finally {
                      setCampusBusy(false);
                    }
                  }}
                  className="text-[13px] font-semibold px-3.5 py-2 rounded-xl bg-brand-navy text-white disabled:opacity-40"
                >
                  {campusBusy ? tr("Saving…") : tr("All at {name}", { name: c.name })}
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {graded && ready && gradeSummary.length > 0 && (
        <SectionCard
          title={tr("Grades")}
          note={`${gradeSummary.reduce((n, g) => n + g.unplaced, 0)} without a teacher`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" data-section="grades">
            {gradeSummary.map((g) => {
              const on = gradeFilter === String(g.grade);
              return (
                <button
                  key={g.grade}
                  type="button"
                  onClick={() => setGradeFilter(on ? "" : String(g.grade))}
                  aria-pressed={on}
                  className={`text-start rounded-2xl border px-3 py-2.5 transition-colors ${
                    on ? "border-brand-navy bg-brand-navy text-white" : "border-surface-border bg-surface-card hover:border-brand-navy"
                  }`}
                >
                  <span className="block text-[13.5px] font-semibold">{gradeLabel(g.grade)}</span>
                  <span className={`block text-[11px] ${on ? "text-white/80" : "text-ink-muted"}`}>
                    {tr("{count} student|{count} students", { count: g.students })}{" · "}{tr("{count} teacher|{count} teachers", { count: g.halaqas })}
                  </span>
                  {g.unplaced > 0 && (
                    <span className={`block text-[11px] font-semibold ${on ? "text-amber-200" : "text-amber-700 dark:text-amber-300"}`}>
                      {tr("{unplaced} without a teacher", { unplaced: g.unplaced })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {gradeFilter !== "" && (
            <button type="button" onClick={() => setGradeFilter("")} className="mt-3 text-[12px] font-semibold text-ink-muted hover:text-ink underline">
              {tr("Show every grade")}
            </button>
          )}
        </SectionCard>
      )}

      {!ready ? (
        <SectionCard title={tr("All students")}>
          <LoadingNote />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title={tr("All students")} note={tr("0 shown")}>
          <EmptyNote>{students.length === 0 ? tr("No students yet.") : tr("No students match that search.")}</EmptyNote>
        </SectionCard>
      ) : byGrade ? (
        byGrade.map(({ grade, students: inGrade }) => (
          <SectionCard
            key={grade}
            title={gradeLabel(grade)}
            note={
              <>
                {tr("{count} student|{count} students", { count: inGrade.length })}
                {!isDemo && (
                  <>
                    {" · "}
                    {halaqasFor(String(grade)).length === 0 && teachers.length === 0 ? (
                      <Link href="/admin/halaqas" className="underline underline-offset-2 hover:text-ink font-bold italic">
                        {tr("Add teachers for this grade")}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startAssigning(assignGrade === grade ? null : grade)}
                        className="underline underline-offset-2 hover:text-ink font-bold italic"
                      >
                        {assignGrade === grade ? tr("Done") : tr("Assign to a teacher")}
                      </button>
                    )}
                  </>
                )}
                {reportsReady && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setGradeReports(grade, !gradeAllOn(grade))}
                      disabled={gradeBusy !== null}
                      className="underline underline-offset-2 hover:text-ink font-bold italic disabled:opacity-50"
                    >
                      {gradeBusy === grade ? tr("Saving…") : gradeAllOn(grade) ? tr("Weekly reports off for this grade") : tr("Weekly reports on for this grade")}
                    </button>
                  </>
                )}
              </>
            }
          >
            {assignGrade === grade ? (
              <div className="space-y-3" data-section="assign">
                {/* While students are ticked, a bar stays at the foot of the
                    screen so one teacher can be given to all of them without
                    scrolling back up a long grade. */}
                {picked.size > 0 && (
                  <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-40 md:start-56 px-3 pb-3 pointer-events-none" data-section="bulk-bar">
                    <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-emerald-500/50 bg-surface-card shadow-2xl p-3 flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">
                        {tr("{count} ticked", { count: picked.size })}
                      </span>
                      <select
                        value={assignTo}
                        onChange={(e) => setAssignTo(e.target.value)}
                        aria-label={tr("Teacher for everyone ticked")}
                        className="flex-1 min-w-[10rem] bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
                      >
                        <option value="">{tr("Choose a teacher…")}</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={`t:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                        <option value="__none">{tr("No teacher (take them out)")}</option>
                      </select>
                      <button
                        type="button"
                        onClick={assignPicked}
                        disabled={!assignTo || assignBusy}
                        className="gradient-emerald text-white text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-40"
                      >
                        {assignBusy ? tr("Saving…") : tr("Give the {count} student this teacher|Give all {count} students this teacher", { count: picked.size })}
                      </button>
                      <button type="button" onClick={() => setPicked(new Set())} className="text-[12px] font-semibold text-ink-muted underline">
                        {tr("Clear")}
                      </button>
                    </div>
                  </div>
                )}
                <div
                  className={`rounded-2xl border p-3 space-y-2.5 ${
                    picked.size > 0 ? "border-emerald-500/50 bg-surface-card" : "border-surface-border bg-surface-bg-warm"
                  }`}
                  data-section="bulk-teacher"
                >
                  <p className="text-[12.5px] font-semibold text-ink">
                    {picked.size > 0
                      ? tr("{count} student ticked — choose one teacher for them:|{count} students ticked — choose one teacher for them all:", { count: picked.size })
                      : tr("Tick students below to give them one teacher together.")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      aria-label={tr("Teacher or halaqa to put them with")}
                      className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink max-w-full"
                    >
                      <option value="">{tr("Choose a teacher or halaqa…")}</option>
                      {teachers.length > 0 && (
                        <optgroup label={tr("Teachers")}>
                          {teachers.map((t) => (
                            <option key={t.id} value={`t:${t.id}`}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {halaqasFor(String(grade)).some((h) => !h.teacherId) && (
                        <optgroup label={tr("{gradeLabel}: halaqas without a teacher", { gradeLabel: gradeLabel(grade) })}>
                          {halaqasFor(String(grade)).filter((h) => !h.teacherId).map((h) => (
                            <option key={h.id} value={h.id}>
                              {halaqaInGrade(h)}
                              {teacherName(h.teacherId) && teacherName(h.teacherId) !== h.name ? ` (${teacherName(h.teacherId)})` : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__none">{tr("No teacher (take them out)")}</option>
                    </select>
                    {assignTo.startsWith("t:") && campuses.length > 1 && (
                      <select
                        value={assignCampus}
                        onChange={(e) => setAssignCampus(e.target.value)}
                        aria-label={tr("Campus")}
                        className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
                      >
                        {campuses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={assignPicked}
                      disabled={picked.size === 0 || !assignTo || assignBusy}
                      className="gradient-emerald text-white text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-40"
                    >
                      {assignBusy
                        ? tr("Saving…")
                        : picked.size > 0
                          ? tr("Give the {count} student this teacher|Give all {count} students this teacher", { count: picked.size })
                          : tr("Assign")}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[12px] font-semibold text-ink-muted">
                    <button type="button" onClick={() => setPicked(new Set(inGrade.filter((s) => !studentHalaqa(s)).map((s) => s.id)))} className="hover:text-ink underline">
                      {tr("Select those without a teacher")}
                    </button>
                    <button type="button" onClick={() => setPicked(new Set(inGrade.map((s) => s.id)))} className="hover:text-ink underline">
                      {tr("Select all")}
                    </button>
                    {picked.size > 0 && (
                      <button type="button" onClick={() => setPicked(new Set())} className="hover:text-ink underline">
                        {tr("Clear")}
                      </button>
                    )}
                  </div>
                  {studentCampusReady && campuses.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-ink-muted">{tr("Or set their campus:")}</span>
                      {campuses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={picked.size === 0 || assignBusy}
                          onClick={async () => {
                            setAssignBusy(true);
                            setAssignNote(null);
                            try {
                              await setCampusFor([...picked], c.id);
                              await loadRealStudents();
                              setAssignNote(tr("{count} student set to {name}.|{count} students set to {name}.", { count: picked.size, name: c.name }));
                              setPicked(new Set());
                            } catch (err) {
                              setAssignNote(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
                            } finally {
                              setAssignBusy(false);
                            }
                          }}
                          className="font-semibold px-2.5 py-1 rounded-lg border border-surface-border bg-surface-card hover:border-brand-navy disabled:opacity-40"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11.5px] text-ink-muted">
                    {tr("Choose each student's teacher on their row — or tap several to select them and give them one teacher together. In this school the teacher is the halaqa: a teacher new to {gradeLabel} gets one in their name.", { gradeLabel: gradeLabel(grade) })}
                  </p>
                  {assignNote && <p className="text-[12.5px] text-ink">{assignNote}</p>}
                </div>
                <ul className="divide-y divide-surface-border -my-1">
                  {inGrade.map((s) => {
                    const h = studentHalaqa(s);
                    return (
                      <li key={s.id} className={`flex items-center gap-2 px-2 -mx-2 rounded-xl transition-colors ${picked.has(s.id) ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-surface-bg-warm"}`}>
                        <label className="flex flex-1 min-w-0 items-center gap-3 py-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={picked.has(s.id)}
                            onChange={() => togglePicked(s.id)}
                            aria-label={s.name}
                            className="w-4 h-4 accent-emerald-700 flex-shrink-0"
                          />
                          <span className="flex-1 min-w-0">
                            <span className={`block text-[13px] font-semibold truncate ${s.active === false ? "text-ink-muted" : "text-ink"}`}>{s.name}</span>
                            <span className={`block text-[11px] ${h ? "text-ink-muted" : "text-amber-700 dark:text-amber-300 font-semibold"}`}>
                              {h ? halaqaInGrade(h) : [campusName(s.campusId), phrase("No teacher yet")].filter(Boolean).join(" · ")}
                              {s.parentNames && s.parentNames.length > 0 && <span className="font-normal text-ink-muted"> · {s.parentNames.join(", ")}</span>}
                            </span>
                          </span>
                        </label>
                        {/* This one student's teacher, straight from their row. */}
                        <select
                          value={h ? (h.teacherId ? `t:${h.teacherId}` : h.id) : ""}
                          onChange={(e) => placeOne(s, e.target.value, grade)}
                          disabled={assignBusy}
                          aria-label={tr("Teacher for {name}", { name: s.name })}
                          className="flex-shrink-0 w-40 sm:w-52 bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-[12px] text-ink disabled:opacity-50"
                        >
                          <option value="">{tr("No teacher yet")}</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={`t:${t.id}`}>
                              {t.name}
                            </option>
                          ))}
                          {halaqasFor(String(grade))
                            .filter((x) => !x.teacherId)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {halaqaInGrade(x)}
                              </option>
                            ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <ul className="divide-y divide-surface-border -my-1">{inGrade.map(renderStudent)}</ul>
            )}
          </SectionCard>
        ))
      ) : (
        <SectionCard title={tr("All students")} note={tr("{count} shown", { count: filtered.length })}>
          <ul className="divide-y divide-surface-border -my-1">{filtered.map(renderStudent)}</ul>
        </SectionCard>
      )}
    </div>
  );
}
