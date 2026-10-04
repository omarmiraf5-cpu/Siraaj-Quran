"use client";

import { useEffect, useState } from "react";
import {
  DEMO_HALAQAS,
  DEMO_TEACHERS,
  DEMO_STUDENTS,
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
  const shown = teachers.filter((t) => t.active !== false || selected.includes(t.id));
  if (shown.length === 0) {
    return <p className="text-xs text-ink-muted">No teachers yet. Add them on the Teachers page.</p>;
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
            {t.admin && <span className="font-normal opacity-80">{t.id === meId ? " · you" : " · admin"}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminHalaqasPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [created, setCreated] = useState<DemoHalaqa[]>([]);
  const [overrides, setOverrides] = useState<Record<string, HalaqaOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newTeacherIds, setNewTeacherIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftTeacherIds, setDraftTeacherIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const [{ data, error }, { data: others }] = await Promise.all([
      supabase.from("classes").select("id, name, teacher_id, schedule").order("name"),
      // A database without class_teachers yet answers with an error here;
      // the halaqas still load, each with its one teacher.
      supabase.from("class_teachers").select("class_id, teacher_id"),
    ]);
    // Surfaced rather than swallowed: a failure here is indistinguishable
    // from a school with no halaqas yet, which sent us hunting through
    // permissions and account links for something the error said outright.
    if (error) throw new Error(`Couldn't load halaqas: ${error.message}`);
    const othersOf = new Map<string, string[]>();
    for (const o of others ?? []) othersOf.set(o.class_id, [...(othersOf.get(o.class_id) ?? []), o.teacher_id]);
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      coTeacherIds: othersOf.get(c.id) ?? [],
      schedule: c.schedule ?? "",
    }));
  };

  const loadRealStudents = async (): Promise<DemoStudent[]> => {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, full_name, active")
      .order("full_name");
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, classes(name)");
    const halaqaByStudent = new Map<string, string>();
    for (const e of enrollments ?? []) {
      const className = (e as unknown as { classes: { name: string } | null }).classes?.name;
      if (className) halaqaByStudent.set(e.student_id, className);
    }
    return (studentRows ?? []).map((s) => ({
      id: s.id,
      name: s.full_name,
      halaqa: halaqaByStudent.get(s.id) ?? "",
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
        loadRealHalaqas().then(setHalaqas),
        loadSchoolTeachers(supabase, { everyAdmin: true }).then(setTeachers),
        loadRealStudents().then(setStudents),
      ]);
    };
    load()
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => setReady(true));
  }, []);

  const addHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSchedule.trim()) return;

    const { lead, others } = splitTeachers(newTeacherIds, null);
    if (isDemo) {
      const halaqa: DemoHalaqa = {
        id: `local-halaqa-${Date.now()}`,
        name: newName.trim(),
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
      setFormError("Your account isn't linked to a school yet — contact support.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: cls, error } = await supabase
        .from("classes")
        .insert({
          name: newName.trim(),
          subject: "Qur'an & Hifz",
          grade: 0,
          schedule: newSchedule.trim(),
          teacher_id: lead,
          school_id: schoolId,
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
      setFormError(err instanceof Error ? err.message : "Failed to add halaqa");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (h: DemoHalaqa) => {
    setEditingId(h.id === editingId ? null : h.id);
    setDraftName(h.name);
    setDraftSchedule(h.schedule);
    setDraftTeacherIds(halaqaTeacherIds(h));
    setEditError(null);
  };

  const saveEdit = async (h: DemoHalaqa) => {
    const { lead, others } = splitTeachers(draftTeacherIds, h.teacherId);
    if (isDemo) {
      const patch: HalaqaOverride = {
        name: draftName.trim() || h.name,
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

    setSavingEdit(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from("classes")
        .update({
          name: draftName.trim() || h.name,
          schedule: draftSchedule.trim() || h.schedule,
          teacher_id: lead,
        })
        .eq("id", h.id);
      if (error) throw error;
      const before = (h.coTeacherIds ?? []).slice().sort().join();
      if (others.slice().sort().join() !== before) await saveOtherTeachers(h.id, others);
      setHalaqas(await loadRealHalaqas());
      if (meId && halaqaTeacherIds(h).includes(meId) !== draftTeacherIds.includes(meId)) staffRolesChanged();
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Classes"
        title="Halaqas"
        meta={[`${halaqas.length} total`, `${students.length} students placed`]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? "Cancel" : "+ Add halaqa"}
          </button>
        }
      />

      {loadError && (
        <div className="card-quiet p-4 border border-red-300 dark:border-red-900">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={addHalaqa} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Halaqa C"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Schedule *</label>
            <input
              value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              placeholder="e.g. Sat–Sun · 10:00–11:30am"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Teachers (optional)</label>
            <p className="text-xs text-ink-muted mb-2">Tap everyone who teaches it. More than one can.</p>
            <TeacherPicker teachers={teachers} selected={newTeacherIds} onChange={setNewTeacherIds} meId={meId} />
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={!newName.trim() || !newSchedule.trim() || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? "Adding…" : "Add halaqa"}
          </button>
        </form>
      )}

      <SectionCard title="All halaqas" note={`${halaqas.length} total`}>
        {!ready ? (
          <LoadingNote />
        ) : halaqas.length === 0 ? (
          <EmptyNote>No halaqas yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {halaqas.map((h) => {
              const isOpen = editingId === h.id;
              const count = studentsInHalaqa(h.name, students).length;
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
                        {halaqaTeacherNames(h, teachers)} · {h.schedule}
                      </p>
                    </div>
                    {halaqaTeacherIds(h).length === 0 && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 flex-shrink-0">
                        Unassigned
                      </span>
                    )}
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Name</label>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Schedule</label>
                        <input
                          value={draftSchedule}
                          onChange={(e) => setDraftSchedule(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1">Teachers</label>
                        <p className="text-[11px] text-ink-muted mb-2">
                          Tap to add or take off. Everyone ticked sees and teaches this halaqa&apos;s children.
                        </p>
                        <TeacherPicker teachers={teachers} selected={draftTeacherIds} onChange={setDraftTeacherIds} meId={meId} />
                      </div>
                      <p className="text-xs text-ink-muted">
                        {count} student{count === 1 ? "" : "s"} currently in this halaqa.
                      </p>
                      {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(h)}
                          disabled={savingEdit}
                          className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
