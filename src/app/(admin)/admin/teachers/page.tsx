"use client";

import { useEffect, useState } from "react";
import {
  DEMO_TEACHERS,
  DEMO_HALAQAS,
  DEMO_CREATED_TEACHERS_KEY,
  DEMO_TEACHER_OVERRIDES_KEY,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  allTeachers,
  allHalaqas,
  initials,
  type TeacherOverride,
  type HalaqaOverride,
} from "@/data/demo";
import type { DemoTeacher, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<DemoTeacher[]>(DEMO_TEACHERS);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>(DEMO_HALAQAS);
  const [created, setCreated] = useState<DemoTeacher[]>([]);
  const [overrides, setOverrides] = useState<Record<string, TeacherOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftActive, setDraftActive] = useState(true);

  useEffect(() => {
    const c = readDemoStore<DemoTeacher[]>(DEMO_CREATED_TEACHERS_KEY, []);
    const o = readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {});
    setCreated(c);
    setOverrides(o);
    setTeachers(allTeachers(c, o));
    setHalaqas(
      allHalaqas(
        readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
        readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
      )
    );
  }, []);

  const addTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    const teacher: DemoTeacher = {
      id: `local-teacher-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
    };
    const next = [...created, teacher];
    setCreated(next);
    writeDemoStore(DEMO_CREATED_TEACHERS_KEY, next);
    setTeachers(allTeachers(next, overrides));
    setNewName("");
    setNewEmail("");
    setShowForm(false);
  };

  const startEditing = (t: DemoTeacher) => {
    setEditingId(t.id === editingId ? null : t.id);
    setDraftName(t.name);
    setDraftEmail(t.email);
    setDraftActive(t.active !== false);
  };

  const saveEdit = (t: DemoTeacher) => {
    const patch: TeacherOverride = {
      name: draftName.trim() || t.name,
      email: draftEmail.trim() || t.email,
      active: draftActive,
    };
    const next = { ...overrides, [t.id]: { ...overrides[t.id], ...patch } };
    setOverrides(next);
    writeDemoStore(DEMO_TEACHER_OVERRIDES_KEY, next);
    setTeachers(allTeachers(created, next));
    setEditingId(null);
  };

  const activeCount = teachers.filter((t) => t.active !== false).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Staff"
        title="Teachers"
        meta={[`${teachers.length} total`, `${activeCount} active`]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? "Cancel" : "+ Add teacher"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={addTeacher} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Full name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ustadha Warsan"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Email *</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@mydiiwaan.com"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <p className="text-xs text-ink-muted">
            New teachers start without a halaqa — assign one from the Halaqas page.
          </p>
          <button
            type="submit"
            disabled={!newName.trim() || !newEmail.trim()}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            Add teacher
          </button>
        </form>
      )}

      <SectionCard title="All teachers" note={`${teachers.length} total`}>
        {teachers.length === 0 ? (
          <EmptyNote>No teachers yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {teachers.map((t) => {
              const isOpen = editingId === t.id;
              const inactive = t.active === false;
              const theirHalaqas = halaqas.filter((h) => h.teacherId === t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => startEditing(t)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                        inactive
                          ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500"
                          : "bg-brand-navy/10 text-brand-navy dark:text-brand-gold"
                      }`}
                    >
                      {initials(t.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${inactive ? "text-ink-muted" : "text-ink"}`}>
                        {t.name}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {t.email}
                        {theirHalaqas.length > 0 && ` · ${theirHalaqas.map((h) => h.name).join(", ")}`}
                      </p>
                    </div>
                    {inactive && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
                        Inactive
                      </span>
                    )}
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Full name</label>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
                        <input
                          type="email"
                          value={draftEmail}
                          onChange={(e) => setDraftEmail(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={draftActive}
                          onChange={(e) => setDraftActive(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        Active
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(t)}
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
