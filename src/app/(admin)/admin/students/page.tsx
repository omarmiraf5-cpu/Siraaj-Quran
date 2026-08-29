"use client";

import { useEffect, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_HALAQAS,
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
import type { DemoStudent, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<DemoStudent[]>(DEMO_STUDENTS);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>(DEMO_HALAQAS);
  const [created, setCreated] = useState<DemoStudent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, StudentOverride>>({});

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHalaqa, setNewHalaqa] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHalaqa, setDraftHalaqa] = useState("");
  const [draftActive, setDraftActive] = useState(true);

  useEffect(() => {
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
  }, []);

  const addStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHalaqa) return;
    const student: DemoStudent = {
      id: `local-student-${Date.now()}`,
      name: newName.trim(),
      halaqa: newHalaqa,
    };
    const next = [...created, student];
    setCreated(next);
    writeDemoStore(DEMO_CREATED_STUDENTS_KEY, next);
    setStudents(allStudents(next, overrides));
    setNewName("");
    setNewHalaqa("");
    setShowForm(false);
  };

  const startEditing = (s: DemoStudent) => {
    setEditingId(s.id === editingId ? null : s.id);
    setDraftName(s.name);
    setDraftHalaqa(s.halaqa);
    setDraftActive(s.active !== false);
  };

  const saveEdit = (s: DemoStudent) => {
    const patch: StudentOverride = {
      name: draftName.trim() || s.name,
      halaqa: draftHalaqa,
      active: draftActive,
    };
    const next = { ...overrides, [s.id]: { ...overrides[s.id], ...patch } };
    setOverrides(next);
    writeDemoStore(DEMO_STUDENT_OVERRIDES_KEY, next);
    setStudents(allStudents(created, next));
    setEditingId(null);
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const activeCount = students.filter((s) => s.active !== false).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Roster"
        title="Students"
        meta={[`${students.length} total`, `${activeCount} active`, `${halaqas.length} halaqas`]}
      />

      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="flex-1 bg-surface-card border border-surface-border rounded-2xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
        />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex-shrink-0 gradient-emerald text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all"
        >
          {showForm ? "Cancel" : "+ Add student"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addStudent} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Full name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Zainab Ali"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Halaqa *</label>
            <select
              value={newHalaqa}
              onChange={(e) => setNewHalaqa(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Select a halaqa</option>
              {halaqas.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!newName.trim() || !newHalaqa}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            Add student
          </button>
        </form>
      )}

      <SectionCard title="All students" note={`${filtered.length} shown`}>
        {filtered.length === 0 ? (
          <EmptyNote>No students match that search.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {filtered.map((s) => {
              const isOpen = editingId === s.id;
              const inactive = s.active === false;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => startEditing(s)}
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
                      {initials(s.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${inactive ? "text-ink-muted" : "text-ink"}`}>
                        {s.name}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">{s.halaqa}</p>
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
                        <label className="block text-xs font-semibold text-ink mb-1.5">Halaqa</label>
                        <select
                          value={draftHalaqa}
                          onChange={(e) => setDraftHalaqa(e.target.value)}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                        >
                          {halaqas.map((h) => (
                            <option key={h.id} value={h.name}>
                              {h.name}
                            </option>
                          ))}
                        </select>
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
                          onClick={() => saveEdit(s)}
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
