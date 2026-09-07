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
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

export default function AdminStudentsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [created, setCreated] = useState<DemoStudent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, StudentOverride>>({});

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHalaqa, setNewHalaqa] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHalaqa, setDraftHalaqa] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftPin, setDraftPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinNote, setPinNote] = useState<string | null>(null);

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

  // A student's halaqa is a separate enrollment row in the real schema
  // (many-to-many), unlike the demo model's plain name field — this folds
  // it back down to "one halaqa name per student" so the rest of the page,
  // built around that simpler shape, doesn't need to change.
  const loadRealStudents = async () => {
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
    setStudents(
      (studentRows ?? []).map((s) => ({
        id: s.id,
        name: s.full_name,
        halaqa: halaqaByStudent.get(s.id) ?? "",
        active: s.active,
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
      await Promise.all([loadRealStudents(), loadRealHalaqas().then(setHalaqas)]);
    };
    load().finally(() => setReady(true));
  }, []);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHalaqa) return;

    if (isDemo) {
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
      return;
    }

    if (!schoolId) return;
    setSaving(true);
    setFormError(null);
    try {
      const name = newName.trim();
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          full_name: name,
          grade: 0,
          avatar_initials: initials(name),
          school_id: schoolId,
        })
        .select("id")
        .single();
      if (studentError) throw studentError;

      const halaqa = halaqas.find((h) => h.name === newHalaqa);
      if (halaqa) {
        const { error: enrollError } = await supabase
          .from("class_enrollments")
          .insert({ class_id: halaqa.id, student_id: student.id });
        if (enrollError) throw enrollError;
      }

      await loadRealStudents();
      setNewName("");
      setNewHalaqa("");
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (s: DemoStudent) => {
    setEditingId(s.id === editingId ? null : s.id);
    setDraftName(s.name);
    setDraftHalaqa(s.halaqa);
    setDraftActive(s.active !== false);
    setDraftPin("");
    setPinNote(null);
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
      if (!res.ok) throw new Error(data.error || "Failed to set PIN");
      setPinNote(`PIN set. ${s.name.split(" ")[0]} can sign in with ${draftPin}.`);
    } catch (err) {
      setPinNote(err instanceof Error ? err.message : "Failed to set PIN");
    } finally {
      setPinSaving(false);
    }
  };

  const saveEdit = async (s: DemoStudent) => {
    if (isDemo) {
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
      return;
    }

    await supabase
      .from("students")
      .update({ full_name: draftName.trim() || s.name, active: draftActive })
      .eq("id", s.id);

    if (draftHalaqa !== s.halaqa) {
      await supabase.from("class_enrollments").delete().eq("student_id", s.id);
      const halaqa = halaqas.find((h) => h.name === draftHalaqa);
      if (halaqa) {
        await supabase
          .from("class_enrollments")
          .insert({ class_id: halaqa.id, student_id: s.id });
      }
    }

    await loadRealStudents();
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
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={!newName.trim() || !newHalaqa || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? "Adding…" : "Add student"}
          </button>
        </form>
      )}

      <SectionCard title="All students" note={`${filtered.length} shown`}>
        {!ready ? (
          <LoadingNote />
        ) : filtered.length === 0 ? (
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

                      {/* A child signs in with four digits rather than an
                          email, so the PIN is set here and read back to
                          whoever forgets it. */}
                      {!isDemo && (
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            Sign-in PIN
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              inputMode="numeric"
                              maxLength={4}
                              value={draftPin}
                              onChange={(e) => setDraftPin(e.target.value.replace(/\D/g, ""))}
                              placeholder="4 digits"
                              className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink tracking-[0.4em] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                            />
                            <button
                              type="button"
                              onClick={() => savePin(s)}
                              disabled={draftPin.length !== 4 || pinSaving}
                              className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 disabled:opacity-40 transition-colors"
                            >
                              {pinSaving ? "Saving…" : "Set PIN"}
                            </button>
                          </div>
                          {pinNote && <p className="text-[11px] text-ink-muted mt-1">{pinNote}</p>}
                        </div>
                      )}
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
