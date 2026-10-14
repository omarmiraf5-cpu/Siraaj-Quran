"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  DEMO_CREATED_TEACHERS_KEY,
  DEMO_TEACHER_OVERRIDES_KEY,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allHalaqas,
  allTeachers,
  allStudents,
  studentsInHalaqa,
  halaqaTeacherIds,
  halaqaTeacherNames,
  type HalaqaOverride,
  type TeacherOverride,
  type StudentOverride,
} from "@/data/demo";
import type { DemoHalaqa, DemoTeacher, DemoStudent } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolTeachers, saveOtherTeachers, splitTeachers, staffRolesChanged } from "@/lib/schoolTeachers";
import { GRADES, gradeLabel } from "@/lib/grades";
import { loadCampuses, loadSchoolShape, type Campus } from "@/lib/schoolStructure";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

const bigField =
  "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";
const smallField =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";

/**
 * The school's teachers as chips: tap to add one to the halaqa, tap again to
 * take them off. Everyone ticked teaches its children. Switched-off teachers
 * are left out unless they're already on it. The school's admins are here
 * too, to teach with their own login.
 */
function TeacherPicker({
  teachers,
  selected,
  onChange,
  meId,
}: {
  teachers: DemoTeacher[];
  selected: string[];
  onChange: (ids: string[]) => void;
  meId: string | null;
}) {
  const { tr } = useLanguage();
  const shown = teachers.filter((t) => t.active !== false || selected.includes(t.id));
  if (shown.length === 0) {
    return <p className="text-xs text-ink-muted">{tr("No teachers yet. Add them on the Teachers page.")}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((t) => {
        const on = selected.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition-all ${
              on
                ? "gradient-emerald text-white"
                : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {on ? "✓ " : ""}
            {t.name}
            {t.admin && <span className="font-normal opacity-80">{t.id === meId ? tr(" · you") : tr(" · admin")}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Where a halaqa is, in a school with grades or campuses: which campus, and which grade. */
function PlaceFields({
  graded,
  campuses,
  grade,
  campusId,
  onGrade,
  onCampus,
  small,
}: {
  graded: boolean;
  campuses: Campus[];
  grade: string;
  campusId: string;
  onGrade: (grade: string) => void;
  onCampus: (campusId: string) => void;
  small?: boolean;
}) {
  const { tr } = useLanguage();
  if (!graded && campuses.length === 0) return null;
  const label = small ? "block text-xs font-semibold text-ink mb-1.5" : "block text-sm font-semibold text-ink mb-2";
  return (
    <div className="grid grid-cols-2 gap-3">
      {campuses.length > 0 && (
        <label className="block">
          <span className={label}>{tr("Campus *")}</span>
          <select value={campusId} onChange={(e) => onCampus(e.target.value)} className={small ? smallField : bigField}>
            <option value="">{tr("Choose…")}</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {graded && (
        <label className="block">
          <span className={label}>{tr("Grade *")}</span>
          <select value={grade} onChange={(e) => onGrade(e.target.value)} className={small ? smallField : bigField}>
            <option value="">{tr("Choose…")}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export default function AdminHalaqasPage() {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  // An academic school keeps its halaqas inside grades, and may have campuses.
  const [graded, setGraded] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [created, setCreated] = useState<DemoHalaqa[]>([]);
  const [overrides, setOverrides] = useState<Record<string, HalaqaOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newTeacherIds, setNewTeacherIds] = useState<string[]>([]);
  const [newGrade, setNewGrade] = useState("");
  const [newCampusId, setNewCampusId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftTeacherIds, setDraftTeacherIds] = useState<string[]>([]);
  const [draftGrade, setDraftGrade] = useState("");
  const [draftCampusId, setDraftCampusId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [newCampus, setNewCampus] = useState("");
  const [campusBusy, setCampusBusy] = useState(false);
  const [campusError, setCampusError] = useState<string | null>(null);

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const [first, { data: others }] = await Promise.all([
      supabase.from("classes").select("id, name, teacher_id, schedule, grade, campus_id").order("name"),
      // A database without class_teachers yet answers with an error here;
      // the halaqas still load, each with its one teacher.
      supabase.from("class_teachers").select("class_id, teacher_id"),
    ]);
    // Before the grades update, there's no campus to ask for.
    const { data, error } = first.error
      ? await supabase.from("classes").select("id, name, teacher_id, schedule, grade").order("name")
      : first;
    // Surfaced rather than swallowed: a failure here is indistinguishable
    // from a school with no halaqas yet, which sent us hunting through
    // permissions and account links for something the error said outright.
    if (error) throw new Error(`Couldn't load halaqas: ${error.message}`);
    const othersOf = new Map<string, string[]>();
    for (const o of others ?? []) othersOf.set(o.class_id, [...(othersOf.get(o.class_id) ?? []), o.teacher_id]);
    return ((data ?? []) as Array<{ id: string; name: string; teacher_id: string | null; schedule: string | null; grade: number; campus_id?: string | null }>).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      coTeacherIds: othersOf.get(c.id) ?? [],
      schedule: c.schedule ?? "",
      grade: c.grade,
      campusId: c.campus_id ?? null,
    }));
  };

  const loadRealStudents = async (): Promise<DemoStudent[]> => {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, full_name, active")
      .order("full_name");
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, class_id, classes(name)");
    const halaqaByStudent = new Map<string, { id: string; name: string }>();
    for (const e of enrollments ?? []) {
      const className = (e as unknown as { classes: { name: string } | null }).classes?.name;
      if (className) halaqaByStudent.set(e.student_id, { id: e.class_id, name: className });
    }
    return (studentRows ?? []).map((s) => ({
      id: s.id,
      name: s.full_name,
      halaqa: halaqaByStudent.get(s.id)?.name ?? "",
      halaqaId: halaqaByStudent.get(s.id)?.id,
      active: s.active,
    }));
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const c = readDemoStore<DemoHalaqa[]>(DEMO_CREATED_HALAQAS_KEY, []);
        const o = readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {});
        setCreated(c);
        setOverrides(o);
        setHalaqas(allHalaqas(c, o));
        setTeachers(
          allTeachers(
            readDemoStore(DEMO_CREATED_TEACHERS_KEY, []),
            readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {})
          )
        );
        setStudents(
          allStudents(
            readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
            readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
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
      setMeId(user.id);
      await Promise.all([
        loadSchoolShape(supabase, profile?.school_id ?? null).then((shape) => {
          setGraded(shape.graded);
          setCampuses(shape.campuses);
        }),
        loadRealHalaqas().then(setHalaqas),
        loadSchoolTeachers(supabase, { everyAdmin: true }).then(setTeachers),
        loadRealStudents().then(setStudents),
      ]);
    };
    load()
      .catch((err) => setLoadError(err instanceof Error ? tr(err.message) : String(err)))
      .finally(() => setReady(true));
  }, []);

  // A grade and campus, as the database keeps them, when the school has them.
  const placeOf = (grade: string, campusId: string) => ({
    ...(graded ? { grade: Number(grade) } : {}),
    ...(campuses.length > 0 ? { campus_id: campusId || null } : {}),
  });
  const placeMissing = (grade: string, campusId: string) =>
    (graded && grade === "") || (campuses.length > 0 && !campusId);

  // In an academic school the teacher is the halaqa: it's called by its
  // (first) teacher's name, and changes name when its teacher changes.
  const teacherNameOf = (id: string | null | undefined) => teachers.find((t) => t.id === id)?.name ?? "";
  const addHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    const { lead, others } = splitTeachers(newTeacherIds, null);
    const name = graded ? teacherNameOf(lead) : newName.trim();
    if (!name || (!graded && !newSchedule.trim()) || placeMissing(newGrade, newCampusId)) return;

    if (isDemo) {
      const halaqa: DemoHalaqa = {
        id: `local-halaqa-${Date.now()}`,
        name,
        schedule: newSchedule.trim(),
        teacherId: lead,
        coTeacherIds: others,
      };
      const next = [...created, halaqa];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_HALAQAS_KEY, next);
      setHalaqas(allHalaqas(next, overrides));
      setNewName("");
      setNewSchedule("");
      setNewTeacherIds([]);
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
      const { data: cls, error } = await supabase
        .from("classes")
        .insert({
          name,
          subject: "Qur'an & Hifz",
          grade: 0,
          schedule: newSchedule.trim(),
          teacher_id: lead,
          school_id: schoolId,
          ...placeOf(newGrade, newCampusId),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (others.length > 0) await saveOtherTeachers(cls.id, others);

      setHalaqas(await loadRealHalaqas());
      if (meId && newTeacherIds.includes(meId)) staffRolesChanged();
      setNewName("");
      setNewSchedule("");
      setNewTeacherIds([]);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? tr(err.message) : tr("Failed to add halaqa"));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (h: DemoHalaqa) => {
    setEditingId(h.id === editingId ? null : h.id);
    setDraftName(h.name);
    setDraftSchedule(h.schedule);
    setDraftTeacherIds(halaqaTeacherIds(h));
    setDraftGrade(h.grade != null ? String(h.grade) : "");
    setDraftCampusId(h.campusId ?? "");
    setEditError(null);
  };

  const saveEdit = async (h: DemoHalaqa) => {
    const { lead, others } = splitTeachers(draftTeacherIds, h.teacherId);
    // A graded school's halaqa follows its teacher's name.
    const editedName = graded ? teacherNameOf(lead) || h.name : draftName.trim() || h.name;
    if (isDemo) {
      const patch: HalaqaOverride = {
        name: editedName,
        schedule: draftSchedule.trim() || h.schedule,
        teacherId: lead,
        coTeacherIds: others,
      };
      const next = { ...overrides, [h.id]: { ...overrides[h.id], ...patch } };
      setOverrides(next);
      writeDemoStore(DEMO_HALAQA_OVERRIDES_KEY, next);
      setHalaqas(allHalaqas(created, next));
      setEditingId(null);
      return;
    }

    if (placeMissing(draftGrade, draftCampusId)) {
      setEditError(graded ? tr("Choose its grade and campus.") : tr("Choose its campus."));
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from("classes")
        .update({
          name: editedName,
          schedule: draftSchedule.trim() || h.schedule,
          teacher_id: lead,
          ...placeOf(draftGrade, draftCampusId),
        })
        .eq("id", h.id);
      if (error) throw error;
      const before = (h.coTeacherIds ?? []).slice().sort().join();
      if (others.slice().sort().join() !== before) await saveOtherTeachers(h.id, others);
      setHalaqas(await loadRealHalaqas());
      if (meId && halaqaTeacherIds(h).includes(meId) !== draftTeacherIds.includes(meId)) staffRolesChanged();
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
    } finally {
      setSavingEdit(false);
    }
  };

  const addCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCampus.trim();
    if (!name || !schoolId) return;
    setCampusBusy(true);
    setCampusError(null);
    const { error } = await supabase.from("campuses").insert({ school_id: schoolId, name });
    if (error) {
      setCampusError(error.code === "23505" ? tr("There's already a campus called {name}.", { name }) : tr(error.message));
    } else {
      setNewCampus("");
      setCampuses(await loadCampuses(supabase));
    }
    setCampusBusy(false);
  };

  const removeCampus = async (c: Campus) => {
    const using = halaqas.filter((h) => h.campusId === c.id).length;
    const question = using
      ? tr("Remove {name}? Its halaqa stays, with no campus until you choose one, and teachers can no longer sign in at its pin.|Remove {name}? Its {count} halaqas stay, with no campus until you choose one, and teachers can no longer sign in at its pin.", { name: c.name, count: using })
      : tr("Remove {name}?", { name: c.name });
    if (!window.confirm(question)) return;
    setCampusBusy(true);
    setCampusError(null);
    const { error } = await supabase.from("campuses").delete().eq("id", c.id);
    if (error) setCampusError(tr(error.message));
    const [fresh, list] = await Promise.all([loadCampuses(supabase), loadRealHalaqas()]);
    setCampuses(fresh);
    setHalaqas(list);
    setCampusBusy(false);
  };

  // How many children are in a halaqa: by its id where names repeat across
  // grades and campuses; by name in the sample school, which has no ids.
  // A halaqa's students, by name.
  const studentsOf = (h: DemoHalaqa) =>
    (isDemo ? studentsInHalaqa(h.name, students) : students.filter((s) => s.halaqaId === h.id)).sort((a, b) => a.name.localeCompare(b.name));
  const countOf = (h: DemoHalaqa) => studentsOf(h).length;
  const placed = isDemo ? students.length : students.filter((s) => s.halaqaId).length;

  // An academic school's halaqas: by campus (when it has them), then grade.
  const sections = (() => {
    if (!graded && campuses.length === 0) return null;
    const places: Array<{ key: string; title: string | null; halaqas: DemoHalaqa[] }> =
      campuses.length > 0
        ? [
            ...campuses.map((c) => ({ key: c.id, title: `${c.name} campus`, halaqas: halaqas.filter((h) => h.campusId === c.id) })),
            { key: "none", title: phrase("No campus yet"), halaqas: halaqas.filter((h) => !campuses.some((c) => c.id === h.campusId)) },
          ]
        : [{ key: "all", title: null, halaqas }];
    return places
      .filter((p) => p.halaqas.length > 0)
      .map((p) => ({
        ...p,
        grades: graded
          ? GRADES.map((g) => ({ grade: g as number | null, halaqas: p.halaqas.filter((h) => (h.grade ?? 0) === g) })).filter((x) => x.halaqas.length > 0)
          : [{ grade: null, halaqas: p.halaqas }],
      }));
  })();

  const renderHalaqa = (h: DemoHalaqa) => {
    const isOpen = editingId === h.id;
    const count = countOf(h);
    return (
      <li key={h.id}>
        <button
          type="button"
          onClick={() => startEditing(h)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
            {count}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{h.name}</p>
            <p className="text-[11px] text-ink-muted truncate">
              {[halaqaTeacherNames(h, teachers), h.schedule].filter(Boolean).join(" · ")}
            </p>
          </div>
          {halaqaTeacherIds(h).length === 0 && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 flex-shrink-0">
              {tr("Unassigned")}
            </span>
          )}
          <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
            <IconArrow size={14} />
          </span>
        </button>

        {isOpen && (
          <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
            {!graded && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Name")}</label>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className={smallField} />
              </div>
            )}
            <PlaceFields
              graded={graded}
              campuses={campuses}
              grade={draftGrade}
              campusId={draftCampusId}
              onGrade={setDraftGrade}
              onCampus={setDraftCampusId}
              small
            />
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Schedule")}</label>
              <input value={draftSchedule} onChange={(e) => setDraftSchedule(e.target.value)} className={smallField} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">{tr("Teachers")}</label>
              <p className="text-[11px] text-ink-muted mb-2">
                {tr("Tap to add or take off. Everyone ticked sees and teaches this halaqa's children.")}
                {graded && tr(" The halaqa is called by the first teacher's name.")}
              </p>
              <TeacherPicker teachers={teachers} selected={draftTeacherIds} onChange={setDraftTeacherIds} meId={meId} />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink mb-1.5">
                {tr("{count} student in this halaqa|{count} students in this halaqa", { count })}
              </p>
              {count === 0 ? (
                <p className="text-[11.5px] text-ink-muted">{tr("None yet. Put students in a halaqa from the Students page.")}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {studentsOf(h).map((s) => (
                    <li
                      key={s.id}
                      className={`text-[12px] rounded-full border border-surface-border bg-surface-card px-2.5 py-1 ${
                        s.active === false ? "text-ink-muted line-through" : "text-ink"
                      }`}
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveEdit(h)}
                disabled={savingEdit}
                className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
              >
                {savingEdit ? tr("Saving…") : tr("Save")}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
              >
                {tr("Cancel")}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Classes")}
        title={tr("Halaqas")}
        meta={[
          tr("{count} total", { count: halaqas.length }),
          ...(campuses.length > 0 ? [tr("{count} campus|{count} campuses", { count: campuses.length })] : []),
          tr("{count} student placed|{count} students placed", { count: placed }),
        ]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? tr("Cancel") : tr("+ Add halaqa")}
          </button>
        }
      />

      {loadError && (
        <div className="card-quiet p-4 border border-red-300 dark:border-red-900">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      )}

      {/* An academic school's sites: each with the same grades, and its own
          pin for staff sign-in (set under Staff attendance). */}
      {!isDemo && (graded || campuses.length > 0) && (
        <section aria-label={tr("Campuses")} className="card-quiet p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow me-1">{tr("Campuses")}</span>
            {campuses.length === 0 && <span className="text-[12.5px] text-ink-muted">{tr("Just the one so far.")}</span>}
            {campuses.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 ps-3 pe-1.5 py-1 rounded-full bg-surface-card border border-surface-border text-[12.5px] font-semibold text-ink"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => removeCampus(c)}
                  disabled={campusBusy}
                  aria-label={tr("Remove {name}", { name: c.name })}
                  className="w-5 h-5 rounded-full text-ink-muted hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 leading-none"
                >
                  ×
                </button>
              </span>
            ))}
            <form onSubmit={addCampus} className="inline-flex items-center gap-1.5">
              <input
                value={newCampus}
                onChange={(e) => setNewCampus(e.target.value.slice(0, 60))}
                placeholder={tr("e.g. North")}
                aria-label={tr("New campus name")}
                className="w-32 bg-surface-card border border-surface-border rounded-full px-3 py-1 text-[12.5px] text-ink focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={!newCampus.trim() || campusBusy}
                className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400 disabled:opacity-40 px-1"
              >
                {tr("+ Add campus")}
              </button>
            </form>
          </div>
          {campusError && <p className="text-xs text-red-600 dark:text-red-400">{campusError}</p>}
        </section>
      )}

      {showForm && (
        <form onSubmit={addHalaqa} className="card-quiet p-5 space-y-4">
          {graded ? (
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">{tr("Teacher *")}</label>
              <p className="text-xs text-ink-muted mb-2">
                {tr("The teacher is the halaqa: it's called by their name. Tap more than one if they teach it together.")}
              </p>
              <TeacherPicker teachers={teachers} selected={newTeacherIds} onChange={setNewTeacherIds} meId={meId} />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">{tr("Name *")}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr("e.g. Halaqa C")} className={bigField} />
            </div>
          )}
          <PlaceFields
            graded={graded}
            campuses={campuses}
            grade={newGrade}
            campusId={newCampusId}
            onGrade={setNewGrade}
            onCampus={setNewCampusId}
          />
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {tr("Schedule")}{" "}{graded ? <span className="font-normal text-ink-muted">{tr("(optional)")}</span> : "*"}
            </label>
            <input
              value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              placeholder={tr("e.g. Sat–Sun · 10:00–11:30am")}
              className={bigField}
            />
          </div>
          {!graded && (
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">{tr("Teachers (optional)")}</label>
              <p className="text-xs text-ink-muted mb-2">{tr("Tap everyone who teaches it. More than one can.")}</p>
              <TeacherPicker teachers={teachers} selected={newTeacherIds} onChange={setNewTeacherIds} meId={meId} />
            </div>
          )}
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={(graded ? newTeacherIds.length === 0 : !newName.trim()) || (!graded && !newSchedule.trim()) || placeMissing(newGrade, newCampusId) || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? tr("Adding…") : tr("Add halaqa")}
          </button>
        </form>
      )}

      {!ready ? (
        <SectionCard title={tr("All halaqas")}>
          <LoadingNote />
        </SectionCard>
      ) : halaqas.length === 0 ? (
        <SectionCard title={tr("All halaqas")} note={tr("0 total")}>
          <EmptyNote>
            {graded
              ? tr("No halaqas yet. Add one for each teacher here (by grade and campus), or put students with a teacher on the Students page — their halaqa is made for you.")
              : tr("No halaqas yet.")}
          </EmptyNote>
        </SectionCard>
      ) : sections ? (
        sections.map((section) => (
          <SectionCard
            key={section.key}
            title={section.title ?? tr("All halaqas")}
            note={`${tr("{count} halaqa|{count} halaqas", { count: section.halaqas.length })} · ${tr("{count} student|{count} students", { count: section.halaqas.reduce((n, h) => n + countOf(h), 0) })}`}
          >
            <div className="space-y-4 -my-1">
              {section.grades.map(({ grade, halaqas: inGrade }) => (
                <div key={grade ?? "all"}>
                  {grade != null && (
                    <p className="eyebrow pt-1">
                      {gradeLabel(grade)} · {tr("{count} halaqa|{count} halaqas", { count: inGrade.length })} ·{" "}
                      {tr("{count} student|{count} students", { count: inGrade.reduce((n, h) => n + countOf(h), 0) })}
                    </p>
                  )}
                  <ul className="divide-y divide-surface-border">{inGrade.map(renderHalaqa)}</ul>
                </div>
              ))}
            </div>
          </SectionCard>
        ))
      ) : (
        <SectionCard title={tr("All halaqas")} note={tr("{count} total", { count: halaqas.length })}>
          <ul className="divide-y divide-surface-border -my-1">{halaqas.map(renderHalaqa)}</ul>
        </SectionCard>
      )}
    </div>
  );
}
