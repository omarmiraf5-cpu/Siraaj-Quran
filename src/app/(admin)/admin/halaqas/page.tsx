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
  teacherName,
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

export default function AdminHalaqasPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [created, setCreated] = useState<DemoHalaqa[]>([]);
  const [overrides, setOverrides] = useState<Record<string, HalaqaOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftTeacherId, setDraftTeacherId] = useState("");

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const { data } = await supabase
      .from("classes")
      .select("id, name, teacher_id, schedule")
      .order("name");
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      schedule: c.schedule ?? "",
    }));
  };

  const loadRealTeachers = async (): Promise<DemoTeacher[]> => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, active")
      .eq("role", "teacher")
      .order("full_name");
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      email: p.email ?? "",
      active: p.active,
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
      await Promise.all([
        loadRealHalaqas().then(setHalaqas),
        loadRealTeachers().then(setTeachers),
        loadRealStudents().then(setStudents),
      ]);
    };
    load().finally(() => setReady(true));
  }, []);

  const addHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSchedule.trim()) return;

    if (isDemo) {
      const halaqa: DemoHalaqa = {
        id: `local-halaqa-${Date.now()}`,
        name: newName.trim(),
        schedule: newSchedule.trim(),
        teacherId: newTeacherId || null,
      };
      const next = [...created, halaqa];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_HALAQAS_KEY, next);
      setHalaqas(allHalaqas(next, overrides));
      setNewName("");
      setNewSchedule("");
      setNewTeacherId("");
      setShowForm(false);
      return;
    }

    if (!schoolId) return;
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.from("classes").insert({
        name: newName.trim(),
        subject: "Qur'an & Hifz",
        grade: 0,
        schedule: newSchedule.trim(),
        teacher_id: newTeacherId || null,
        school_id: schoolId,
      });
      if (error) throw error;

      setHalaqas(await loadRealHalaqas());
      setNewName("");
      setNewSchedule("");
      setNewTeacherId("");
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
    setDraftTeacherId(h.teacherId ?? "");
  };

  const saveEdit = async (h: DemoHalaqa) => {
    if (isDemo) {
      const patch: HalaqaOverride = {
        name: draftName.trim() || h.name,
        schedule: draftSchedule.trim() || h.schedule,
        teacherId: draftTeacherId || null,
      };
      const next = { ...overrides, [h.id]: { ...overrides[h.id], ...patch } };
      setOverrides(next);
      writeDemoStore(DEMO_HALAQA_OVERRIDES_KEY, next);
      setHalaqas(allHalaqas(created, next));
      setEditingId(null);
      return;
    }

    await supabase
      .from("classes")
      .update({
        name: draftName.trim() || h.name,
        schedule: draftSchedule.trim() || h.schedule,
        teacher_id: draftTeacherId || null,
      })
      .eq("id", h.id);
    setHalaqas(await loadRealHalaqas());
    setEditingId(null);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
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
            <label className="block text-sm font-semibold text-ink mb-2">Teacher (optional)</label>
            <select
              value={newTeacherId}
              onChange={(e) => setNewTeacherId(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      {count}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{h.name}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {teacherName(h.teacherId, teachers)} · {h.schedule}
                      </p>
                    </div>
                    {!h.teacherId && (
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
                        <label className="block text-xs font-semibold text-ink mb-1.5">Teacher</label>
                        <select
                          value={draftTeacherId}
                          onChange={(e) => setDraftTeacherId(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        >
                          <option value="">Unassigned</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-ink-muted">
                        {count} student{count === 1 ? "" : "s"} currently in this halaqa.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(h)}
                          className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all"
                        >
                          Save
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
