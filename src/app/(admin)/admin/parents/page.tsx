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
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { welcomeNote } from "@/lib/welcomeNote";
import { DeleteAccount, deleteAccount, saveAccount } from "@/components/DeleteAccount";
import { IconArrow } from "@/components/icons";
import ParentImport from "@/components/ParentImport";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

interface ParentRow {
  id: string;
  name: string;
  email: string;
  childIds: string[];
  active?: boolean;
  /** A teacher's or the office's own login, linked as a parent too. */
  staffRole?: "teacher" | "admin";
}

const DEMO_PARENTS: ParentRow[] = [
  { id: "p1", name: "Khalid Nur", email: "parent@mydiiwaan.com", childIds: ["s1", "s2"] },
];

const DEMO_CREATED_PARENTS_KEY = "demo_created_parents";

export default function AdminParentsPage() {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  const [parents, setParents] = useState<ParentRow[]>([]);
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [created, setCreated] = useState<ParentRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newChildIds, setNewChildIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  // The parent whose row is open, with its on/off switch as it's being edited.
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftActive, setDraftActive] = useState(true);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const toggleOpen = (p: ParentRow) => {
    setOpenId(p.id === openId ? null : p.id);
    setDraftActive(p.active !== false);
    setSwitchError(null);
  };

  // Through the server, which also has Supabase refuse a switched-off
  // parent's sign-ins.
  const saveSwitch = async (p: ParentRow) => {
    if (isDemo) {
      setNote(tr("Sample data — there's no real account to switch off."));
      return;
    }
    setSavingSwitch(true);
    setSwitchError(null);
    try {
      await saveAccount(p.id, { active: draftActive });
      await loadReal();
      setOpenId(null);
    } catch (err) {
      setSwitchError(err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again."));
    } finally {
      setSavingSwitch(false);
    }
  };

  // The school's own way back when a parent loses the temporary password
  // they were given — the same thing the Teachers page offers, so neither
  // has to come back to whoever holds the database.
  const resetPassword = async (p: ParentRow) => {
    if (isDemo) {
      setNote(tr("Sample data — there's no real account to reset."));
      return;
    }
    setResettingId(p.id);
    setNote(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || phrase("Couldn't reset the password"));
      setNote(
        tr("New temporary password for {n}: {temp_password} — share it with them. They'll set their own the next time they sign in.", { n: data.full_name || p.name, temp_password: data.temp_password })
      );
    } catch (err) {
      setNote(err instanceof Error ? tr(err.message) : tr("Couldn't reset the password"));
    } finally {
      setResettingId(null);
    }
  };

  // Or a link by email, so they choose a new password themselves and
  // nobody has to pass one on.
  const emailResetLink = async (p: ParentRow) => {
    if (isDemo) {
      setNote(tr("Sample data — there's no real account to email."));
      return;
    }
    setResettingId(p.id);
    setNote(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: p.id, by: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || phrase("Couldn't send the email"));
      setNote(
        tr("Emailed {email} a link to choose a new password. It works once, for 14 days, and their current password keeps working until they use it.", { email: data.email })
      );
    } catch (err) {
      setNote(err instanceof Error ? tr(err.message) : tr("Couldn't send the email"));
    } finally {
      setResettingId(null);
    }
  };

  const loadReal = async () => {
    const { data: links } = await supabase.from("parent_students").select("parent_id, student_id");
    // The school's parents, and its teachers and office who are parents too.
    const linkedIds = [...new Set((links ?? []).map((l) => l.parent_id as string))];
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, active, role")
      .or(`role.eq.parent${linkedIds.length ? `,id.in.(${linkedIds.join(",")})` : ""}`)
      .order("full_name");
    const childrenByParent = new Map<string, string[]>();
    for (const l of links ?? []) {
      childrenByParent.set(l.parent_id, [...(childrenByParent.get(l.parent_id) ?? []), l.student_id]);
    }

    setParents(
      (profileRows ?? []).map((p) => ({
        id: p.id,
        name: p.role && p.role !== "parent" ? `${p.full_name} (${p.role === "admin" ? "office" : "teacher"})` : p.full_name,
        staffRole: p.role === "teacher" || p.role === "admin" ? p.role : undefined,
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
    load().finally(() => setReady(true));
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
      if (!res.ok) throw new Error([data.error, data.debug].filter(Boolean).join(" — ") || phrase("Failed to create parent account"));
      await loadReal();
      resetForm();
      if (data.staff_parent) {
        setNote(
          tr(
            data.staff_parent === "admin"
              ? "{name} is one of your admins, so no new login was made: {children} linked to the login they have, and they'll find them under Parent mode in their menu."
              : "{name} is one of your teachers, so no new login was made: {children} linked to the login they have, and they'll find them under Parent mode in their menu.",
            { name: data.full_name || data.email, children: tr("{count} child is|{count} children are", { count: data.linked }) },
          )
        );
        return;
      }
      setNote(
        [
          data.warning,
          data.warning ? "" : tr("Account created for {email}.", { email: data.email }),
          welcomeNote(data.welcome_email),
          tr("Temporary password: {password} — share it with them if the email doesn't reach them. They'll be asked to set their own password the first time they use it.", { password: data.temp_password }),
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (err) {
      setNote(err instanceof Error ? tr(err.message) : tr("Failed to create parent account"));
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

  const childName = (id: string) => students.find((s) => s.id === id)?.name ?? phrase("Unknown");
  const unlinked = parents.filter((p) => p.childIds.length === 0).length;

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Families")}
        title={tr("Parents")}
        meta={[
          tr("{count} total", { count: parents.length }),
          unlinked ? tr("{count} with no child linked", { count: unlinked }) : tr("all linked to a child"),
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isDemo && (
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                aria-expanded={showImport}
                className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
              >
                {tr("Import from a spreadsheet")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
            >
              {showForm ? tr("Cancel") : tr("+ Add parent")}
            </button>
          </div>
        }
      />

      {showImport && <ParentImport students={students} onDone={() => loadReal()} onClose={() => setShowImport(false)} />}

      {showForm && (
        <form onSubmit={addParent} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">{tr("Full name *")}</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={tr("e.g. Khalid Nur")}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">{tr("Email *")}</label>
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
              {tr("Their children")}{" "}<span className="font-normal text-ink-muted">{tr("(pick any)")}</span>
            </label>
            {students.length === 0 ? (
              <EmptyNote>{tr("Add students first, then you can link them here.")}</EmptyNote>
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
              ? tr("In the demo this is stored locally — no real account is created.")
              : tr("We'll email them a link to choose their own password, and you'll get a temporary password to share in case the email doesn't reach them. They see only the children linked here.")}
          </p>
          <button
            type="submit"
            disabled={!newName.trim() || !newEmail.trim() || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {isDemo ? tr("Add parent") : saving ? tr("Creating…") : tr("Create login")}
          </button>
        </form>
      )}

      {note && (
        <div className="card-quiet p-4 text-sm text-ink border border-emerald-600/30">{note}</div>
      )}

      <SectionCard title={tr("All parents")} note={tr("{count} total", { count: parents.length })}>
        {!ready ? (
          <LoadingNote />
        ) : parents.length === 0 ? (
          <EmptyNote>{tr("No parent accounts yet.")}</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {parents.map((p) => {
              const isOpen = openId === p.id;
              const inactive = p.active === false;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(p)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                        inactive
                          ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500"
                          : "bg-brand-navy/10 text-brand-navy dark:text-brand-gold"
                      }`}
                    >
                      {initials(p.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${inactive ? "text-ink-muted" : "text-ink"}`}>{p.name}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {p.email}
                        {p.childIds.length > 0
                          ? ` · ${p.childIds.map(childName).join(", ")}`
                          : tr(" · no child linked")}
                      </p>
                    </div>
                    {inactive && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
                        {tr("Inactive")}
                      </span>
                    )}
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && p.staffRole && (
                    // A teacher's (or the office's) own login: managed on the
                    // Teachers page. Here, only their link to their children.
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      <p className="text-[13px] text-ink leading-relaxed">
                        {tr("This is {replace}'s own", { replace: p.name.replace(/ \((teacher|office)\)$/, "") })}{" "}{p.staffRole === "admin" ? "office" : "teacher"}{" "}{tr("login — they see their children under")}{" "}<strong>{tr("Parent mode")}</strong>{" "}{tr("in their menu. Their login is looked after on the Teachers page.")}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(tr("Take {count} child off {name}? Parent mode goes too.|Take {count} children off {name}? Parent mode goes too.", { count: p.childIds.length, name: p.name }))) return;
                          const { error } = await supabase.from("parent_students").delete().eq("parent_id", p.id);
                          if (error) setNote(tr(error.message));
                          setOpenId(null);
                          await loadReal();
                        }}
                        className="text-[13px] font-semibold text-red-700 dark:text-red-300 hover:underline"
                      >
                        {tr("Unlink their children")}
                      </button>
                    </div>
                  )}
                  {isOpen && !p.staffRole && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={draftActive}
                          onChange={(e) => setDraftActive(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        {tr("Active")}
                      </label>
                      <p className="text-[11px] text-ink-muted -mt-1 leading-relaxed">
                        {tr("Untick to switch {name} off: they can't sign in or see anything until you switch them back on.", { name: p.name })}
                      </p>
                      {switchError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{switchError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveSwitch(p)}
                          disabled={savingSwitch}
                          className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
                        >
                          {savingSwitch ? tr("Saving…") : tr("Save")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenId(null)}
                          className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                        >
                          {tr("Cancel")}
                        </button>
                      </div>

                      <div className="pt-3 border-t border-surface-border">
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          <button
                            type="button"
                            onClick={() => emailResetLink(p)}
                            disabled={resettingId === p.id}
                            className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors disabled:opacity-50"
                          >
                            {tr("Email a reset link")}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(p)}
                            disabled={resettingId === p.id}
                            className="text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                          >
                            {resettingId === p.id ? tr("Working…") : tr("Get a temporary password")}
                          </button>
                        </div>
                      </div>

                      {!isDemo && (
                        <div className="pt-3 border-t border-surface-border">
                          <DeleteAccount
                            name={p.name}
                            consequences={tr("This deletes {name}'s sign-in for good. Their children stay at the school, and messages they sent stay without their name. To keep them but stop them signing in, untick Active instead.", { name: p.name })}
                            onDelete={async () => {
                              await deleteAccount(p.id);
                              setOpenId(null);
                              await loadReal();
                            }}
                          />
                        </div>
                      )}
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
