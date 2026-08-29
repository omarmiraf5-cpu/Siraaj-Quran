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
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

export default function AdminHalaqasPage() {
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>(DEMO_HALAQAS);
  const [teachers, setTeachers] = useState<DemoTeacher[]>(DEMO_TEACHERS);
  const [students, setStudents] = useState<DemoStudent[]>(DEMO_STUDENTS);
  const [created, setCreated] = useState<DemoHalaqa[]>([]);
  const [overrides, setOverrides] = useState<Record<string, HalaqaOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftTeacherId, setDraftTeacherId] = useState("");

  useEffect(() => {
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
  }, []);

  const addHalaqa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSchedule.trim()) return;
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
  };

  const startEditing = (h: DemoHalaqa) => {
    setEditingId(h.id === editingId ? null : h.id);
    setDraftName(h.name);
    setDraftSchedule(h.schedule);
    setDraftTeacherId(h.teacherId ?? "");
  };

  const saveEdit = (h: DemoHalaqa) => {
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
          <button
            type="submit"
            disabled={!newName.trim() || !newSchedule.trim()}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            Add halaqa
          </button>
        </form>
      )}

      <SectionCard title="All halaqas" note={`${halaqas.length} total`}>
        {halaqas.length === 0 ? (
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
