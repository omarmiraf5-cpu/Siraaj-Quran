"use client";

import { useEffect, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allStudents,
  initials,
  type DemoStudent,
  type StudentOverride,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

interface ParentRow {
  id: string;
  name: string;
  email: string;
  childIds: string[];
  active?: boolean;
}

const DEMO_PARENTS: ParentRow[] = [
  { id: "p1", name: "Khalid Nur", email: "parent@mydiiwaan.com", childIds: ["s1", "s2"] },
];

const DEMO_CREATED_PARENTS_KEY = "demo_created_parents";

export default function AdminParentsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);

  const [parents, setParents] = useState<ParentRow[]>(DEMO_PARENTS);
  const [students, setStudents] = useState<DemoStudent[]>(DEMO_STUDENTS);
  const [created, setCreated] = useState<ParentRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newChildIds, setNewChildIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadReal = async () => {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, active")
      .eq("role", "parent")
      .order("full_name");

    const { data: links } = await supabase.from("parent_students").select("parent_id, student_id");
    const childrenByParent = new Map<string, string[]>();
    for (const l of links ?? []) {
      childrenByParent.set(l.parent_id, [...(childrenByParent.get(l.parent_id) ?? []), l.student_id]);
    }

    setParents(
      (profileRows ?? []).map((p) => ({
        id: p.id,
        name: p.full_name,
        email: p.email ?? "",
        childIds: childrenByParent.get(p.id) ?? [],
        active: p.active,
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
        const c = readDemoStore<ParentRow[]>(DEMO_CREATED_PARENTS_KEY, []);
        setCreated(c);
        setParents([...DEMO_PARENTS, ...c]);
        setStudents(
          allStudents(
            readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
            readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
          )
        );
        return;
      }

      const { data: studentRows } = await supabase
        .from("students")
        .select("id, full_name, active")
        .order("full_name");
      setStudents(
        (studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "", active: s.active }))
      );
      await loadReal();
    };
    load();
  }, []);

  const toggleChild = (id: string) => {
    setNewChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const addParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    setNote(null);

    if (isDemo) {
      const parent: ParentRow = {
        id: `local-parent-${Date.now()}`,
        name: newName.trim(),
        email: newEmail.trim(),
        childIds: newChildIds,
      };
      const next = [...created, parent];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_PARENTS_KEY, next);
      setParents([...DEMO_PARENTS, ...next]);
      resetForm();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "parent",
          full_name: newName.trim(),
          email: newEmail.trim(),
          student_ids: newChildIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create parent account");
      await loadReal();
      resetForm();
      setNote(
        data.warning ??
          `Account created for ${data.email}. Temporary password: ${data.temp_password} — share this with them so they can sign in.`
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to create parent account");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewChildIds([]);
    setShowForm(false);
  };

  const childName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown";
  const unlinked = parents.filter((p) => p.childIds.length === 0).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Families"
        title="Parents"
        meta={[
          `${parents.length} total`,
          unlinked ? `${unlinked} with no child linked` : "all linked to a child",
        ]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? "Cancel" : "+ Add parent"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={addParent} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Full name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Khalid Nur"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Email *</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Their children <span className="font-normal text-ink-muted">(pick any)</span>
            </label>
            {students.length === 0 ? (
              <EmptyNote>Add students first, then you can link them here.</EmptyNote>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((s) => {
                  const on = newChildIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleChild(s.id)}
                      className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
                        on
                          ? "gradient-emerald text-white"
                          : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-ink-muted">
            {isDemo
              ? "In the demo this is stored locally — no real account is created."
              : "You'll get a temporary password to share with them. They see only the children linked here."}
          </p>
          <button
            type="submit"
            disabled={!newName.trim() || !newEmail.trim() || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {isDemo ? "Add parent" : saving ? "Creating…" : "Create login"}
          </button>
        </form>
      )}

      {note && (
        <div className="card-quiet p-4 text-sm text-ink border border-emerald-600/30">{note}</div>
      )}

      <SectionCard title="All parents" note={`${parents.length} total`}>
        {parents.length === 0 ? (
          <EmptyNote>No parent accounts yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {parents.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                  {initials(p.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{p.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {p.email}
                    {p.childIds.length > 0
                      ? ` · ${p.childIds.map(childName).join(", ")}`
                      : " · no child linked"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
