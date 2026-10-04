"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DEMO_TEACHERS,
  DEMO_HALAQAS,
  DEMO_CREATED_TEACHERS_KEY,
  DEMO_TEACHER_OVERRIDES_KEY,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  allTeachers,
  allHalaqas,
  halaqaTeacherIds,
  initials,
  type TeacherOverride,
  type HalaqaOverride,
} from "@/data/demo";
import type { DemoTeacher, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { welcomeNote } from "@/lib/welcomeNote";
import { DeleteAccount, deleteAccount, saveAccount } from "@/components/DeleteAccount";
import { loadSchoolTeachers, saveHalaqaTeachers, staffRolesChanged } from "@/lib/schoolTeachers";

/** The halaqas as chips, to tick the ones someone teaches. */
function HalaqaChips({
  halaqas,
  selected,
  onChange,
}: {
  halaqas: DemoHalaqa[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (halaqas.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        There are no halaqas yet. Add one under{" "}
        <Link href="/admin/halaqas" className="font-semibold underline underline-offset-2">
          Halaqas
        </Link>{" "}
        and tick yourself as its teacher.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {halaqas.map((h) => {
        const on = selected.includes(h.id);
        return (
          <button
            key={h.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== h.id) : [...selected, h.id])}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition-all ${
              on ? "gradient-emerald text-white" : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {on ? "✓ " : ""}
            {h.name}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminTeachersPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [created, setCreated] = useState<DemoTeacher[]>([]);
  const [overrides, setOverrides] = useState<Record<string, TeacherOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  // The signed-in admin, who can teach with their own login: typing their
  // own email here picks their halaqas rather than making a second login.
  const [me, setMe] = useState<{ id: string; email: string; name: string } | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [teachError, setTeachError] = useState<string | null>(null);
  const isSelf = !!me && newEmail.trim().toLowerCase() === me.email.toLowerCase();
  const myHalaqaIds = (list: DemoHalaqa[]) => (me ? list.filter((h) => halaqaTeacherIds(h).includes(me.id)).map((h) => h.id) : []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Real halaqas, for showing each teacher's assignment(s) — kept as a
  // separate loader so the demo path can reuse it unchanged.
  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const [{ data }, { data: others }] = await Promise.all([
      supabase.from("classes").select("id, name, teacher_id, schedule").order("name"),
      supabase.from("class_teachers").select("class_id, teacher_id"),
    ]);
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

  const loadRealTeachers = async () => {
    setTeachers(await loadSchoolTeachers(supabase));
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
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
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setMe({ id: user.id, email: user.email ?? "", name: profile?.full_name ?? "" });
      await Promise.all([loadRealTeachers(), loadRealHalaqas().then(setHalaqas)]);
    };
    load().finally(() => setReady(true));
  }, []);

  // Their own email typed in: start from the halaqas they already teach.
  useEffect(() => {
    if (isSelf) {
      setMine(myHalaqaIds(halaqas));
      setTeachError(null);
    }
    // Only as the email comes to match; the halaqas don't change meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf]);

  /**
   * The signed-in admin teaches exactly the halaqas in `chosen`, under the
   * name given: their own login, put on each halaqa or taken off it.
   */
  const saveMyTeaching = async (chosen: string[], name: string) => {
    if (!me) return;
    const trimmed = name.trim();
    if (trimmed && trimmed !== me.name) {
      const { error } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", me.id);
      if (error) throw error;
    }
    for (const h of halaqas) {
      const ids = halaqaTeacherIds(h);
      const want = chosen.includes(h.id);
      if (ids.includes(me.id) === want) continue;
      await saveHalaqaTeachers(supabase, h, want ? [...ids, me.id] : ids.filter((id) => id !== me.id));
    }
    setMe({ ...me, name: trimmed || me.name });
    const [list, fresh] = await Promise.all([loadSchoolTeachers(supabase), loadRealHalaqas()]);
    setTeachers(list);
    setHalaqas(fresh);
    staffRolesChanged();
    return halaqas.filter((h) => chosen.includes(h.id)).map((h) => h.name);
  };

  const addTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSelf) {
      setInviting(true);
      setTeachError(null);
      try {
        const names = (await saveMyTeaching(mine, newName)) ?? [];
        setNewName("");
        setNewEmail("");
        setShowForm(false);
        setInviteNote(
          names.length > 0
            ? `You teach ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]} with your own login — open My halaqa in the menu to get to your students.`
            : "You don't teach a halaqa now."
        );
      } catch (err) {
        setTeachError(err instanceof Error ? err.message : "That didn't save. Please try again.");
      } finally {
        setInviting(false);
      }
      return;
    }
    if (!newName.trim() || !newEmail.trim()) return;

    if (isDemo) {
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
      return;
    }

    setInviting(true);
    setInviteNote(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "teacher",
          full_name: newName.trim(),
          email: newEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.debug].filter(Boolean).join(" — ") || "Failed to create teacher");
      await loadRealTeachers();
      setNewName("");
      setNewEmail("");
      setShowForm(false);
      setInviteNote(
        `Account created for ${data.email}. ${welcomeNote(data.welcome_email)}Temporary password: ${data.temp_password} — share it with them if the email doesn't reach them. They'll be asked to set their own password the first time they use it.`
      );
    } catch (err) {
      setInviteNote(err instanceof Error ? err.message : "Failed to create teacher");
    } finally {
      setInviting(false);
    }
  };

  const startEditing = (t: DemoTeacher) => {
    setEditingId(t.id === editingId ? null : t.id);
    setDraftName(t.name);
    setDraftEmail(t.email);
    setDraftActive(t.active !== false);
    setResetNote(null);
    setSaveError(null);
    if (t.id === me?.id) setMine(myHalaqaIds(halaqas));
  };

  // Their own row: the name parents and children see, and what they teach.
  const saveMine = async () => {
    setSavingEdit(true);
    setSaveError(null);
    try {
      await saveMyTeaching(mine, draftName);
      setEditingId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  // A teacher's temporary password is shown once, when the account is made.
  // This is the school's own way back from losing it, so a forgotten
  // password doesn't have to travel to whoever holds the database.
  const resetPassword = async (t: DemoTeacher) => {
    if (isDemo) {
      setResetNote("Sample data — there's no real account to reset.");
      return;
    }
    setResetting(true);
    setResetNote(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: t.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't reset the password");
      setResetNote(
        `New temporary password for ${data.full_name || t.name}: ${data.temp_password} — share it with them. They'll set their own the next time they sign in.`
      );
    } catch (err) {
      setResetNote(err instanceof Error ? err.message : "Couldn't reset the password");
    } finally {
      setResetting(false);
    }
  };

  const saveEdit = async (t: DemoTeacher) => {
    if (isDemo) {
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
      return;
    }

    // Through the server, which also has Supabase refuse a switched-off
    // teacher's sign-ins. Email is the account's real sign-in identity, so
    // it isn't editable from this simple form — only name and active are.
    setSavingEdit(true);
    setSaveError(null);
    try {
      await saveAccount(t.id, { full_name: draftName.trim() || t.name, active: draftActive });
      await loadRealTeachers();
      setEditingId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const activeCount = teachers.filter((t) => t.active !== false).length;

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
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
            <label className="block text-sm font-semibold text-ink mb-2">
              {isSelf ? "Your name, as parents and children see it" : "Full name *"}
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isSelf ? me?.name || "e.g. Ustadh Omar" : "e.g. Ustadha Warsan"}
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
          {isSelf ? (
            <div className="rounded-2xl border border-emerald-600/30 bg-surface-bg-warm p-4 space-y-3">
              <p className="text-sm text-ink leading-relaxed">
                That&apos;s you. Your admin login works for teaching too, so there&apos;s no second login to make —
                tick the halaqas you teach.
              </p>
              <HalaqaChips halaqas={halaqas} selected={mine} onChange={setMine} />
              {teachError && <p className="text-xs text-red-600 dark:text-red-400">{teachError}</p>}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">
              {isDemo
                ? "New teachers start without a halaqa — assign one from the Halaqas page."
                : "We'll email them a link to choose their own password, and you'll get a temporary password to share in case the email doesn't reach them. They start without a halaqa assigned."}
              {me && ` Teaching a halaqa yourself? Enter your own email, ${me.email}.`}
            </p>
          )}
          <button
            type="submit"
            disabled={isSelf ? inviting || halaqas.length === 0 : !newName.trim() || !newEmail.trim() || inviting}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {isSelf ? (inviting ? "Saving…" : "Teach with my login") : isDemo ? "Add teacher" : inviting ? "Creating…" : "Create login"}
          </button>
        </form>
      )}

      {inviteNote && (
        <div className="card-quiet p-4 text-sm text-ink border border-emerald-600/30">
          {inviteNote}
        </div>
      )}

      <SectionCard title="All teachers" note={`${teachers.length} total`}>
        {!ready ? (
          <LoadingNote />
        ) : teachers.length === 0 ? (
          <EmptyNote>No teachers yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {teachers.map((t) => {
              const isOpen = editingId === t.id;
              const inactive = t.active === false;
              const theirHalaqas = halaqas.filter((h) => halaqaTeacherIds(h).includes(t.id));
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => startEditing(t)}
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
                    {t.admin && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex-shrink-0">
                        {t.id === me?.id ? "You · admin" : "Admin"}
                      </span>
                    )}
                    {inactive && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
                        Inactive
                      </span>
                    )}
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && t.admin && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      {t.id === me?.id ? (
                        <>
                          <p className="text-[12.5px] text-ink-body leading-relaxed">
                            This is your own login: you run the school with it, and teach with it too.
                          </p>
                          <div>
                            <label className="block text-xs font-semibold text-ink mb-1.5">Your name, as parents and children see it</label>
                            <input
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                            />
                          </div>
                          <div>
                            <p className="block text-xs font-semibold text-ink mb-1.5">The halaqas you teach</p>
                            <HalaqaChips halaqas={halaqas} selected={mine} onChange={setMine} />
                          </div>
                          {saveError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{saveError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveMine}
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
                        </>
                      ) : (
                        <p className="text-[12.5px] text-ink-body leading-relaxed">
                          {t.name} runs the school with this login, and teaches with it too. Which halaqas they teach is
                          set under{" "}
                          <Link href="/admin/halaqas" className="font-semibold underline underline-offset-2">
                            Halaqas
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                  )}

                  {isOpen && !t.admin && (
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
                          disabled={!isDemo}
                          className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        {!isDemo && (
                          <p className="text-[11px] text-ink-muted mt-1">
                            Email is the sign-in address and can&apos;t be changed here.
                          </p>
                        )}
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
                      <p className="text-[11px] text-ink-muted -mt-1 leading-relaxed">
                        Untick to switch {t.name} off: they can&apos;t sign in or see anything
                        until you switch them back on.
                      </p>
                      {saveError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{saveError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(t)}
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

                      <div className="pt-3 border-t border-surface-border">
                        <button
                          type="button"
                          onClick={() => resetPassword(t)}
                          disabled={resetting}
                          className="text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                        >
                          {resetting ? "Resetting…" : "Reset password"}
                        </button>
                        {resetNote && (
                          <p className="text-[11px] text-ink mt-2 leading-relaxed break-words">{resetNote}</p>
                        )}
                      </div>

                      {!isDemo && (
                        <div className="pt-3 border-t border-surface-border">
                          <DeleteAccount
                            name={t.name}
                            consequences={`This deletes ${t.name}'s sign-in for good. The register, lessons and messages they recorded stay with the school without their name, and a halaqa they teach alone will need another teacher. To keep them but stop them signing in, untick Active instead.`}
                            onDelete={async () => {
                              await deleteAccount(t.id);
                              setEditingId(null);
                              await loadRealTeachers();
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
