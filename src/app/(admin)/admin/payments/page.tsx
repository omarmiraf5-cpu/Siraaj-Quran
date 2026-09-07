"use client";

import { useEffect, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_FEES,
  DEMO_CREATED_FEES_KEY,
  DEMO_FEE_OVERRIDES_KEY,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allFees,
  allStudents,
  feeStatus,
  money,
  initials,
  FEE_STATUS_LABELS,
  FEE_STATUS_STYLES,
  type DemoFee,
  type FeeOverride,
  type DemoStudent,
  type StudentOverride,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

export default function AdminPaymentsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [fees, setFees] = useState<DemoFee[]>([]);
  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [created, setCreated] = useState<DemoFee[]>([]);
  const [overrides, setOverrides] = useState<Record<string, FeeOverride>>({});

  const [showForm, setShowForm] = useState(false);
  const [newStudent, setNewStudent] = useState("");
  const [newDescription, setNewDescription] = useState("Term 1 tuition");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const loadRealStudents = async (): Promise<DemoStudent[]> => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, active")
      .order("full_name");
    return (data ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "", active: s.active }));
  };

  const loadRealFees = async () => {
    const { data } = await supabase
      .from("fees")
      .select("id, student_id, description, amount_due, amount_paid, due_date, term")
      .order("due_date");
    setFees(
      (data ?? []).map((f) => ({
        id: f.id,
        studentId: f.student_id,
        description: f.description,
        amountDue: Number(f.amount_due),
        amountPaid: Number(f.amount_paid),
        dueDate: f.due_date,
        term: f.term,
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
        const c = readDemoStore<DemoFee[]>(DEMO_CREATED_FEES_KEY, []);
        const o = readDemoStore<Record<string, FeeOverride>>(DEMO_FEE_OVERRIDES_KEY, {});
        setCreated(c);
        setOverrides(o);
        setFees(allFees(c, o));
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
      await Promise.all([loadRealFees(), loadRealStudents().then(setStudents)]);
    };
    load().finally(() => setReady(true));
  }, []);

  const addFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newAmount);
    if (!newStudent || !newDescription.trim() || !amount || !newDueDate) return;
    setFormError(null);

    if (isDemo) {
      const fee: DemoFee = {
        id: `local-fee-${Date.now()}`,
        studentId: newStudent,
        description: newDescription.trim(),
        amountDue: amount,
        amountPaid: 0,
        dueDate: newDueDate,
        term: 1,
      };
      const next = [...created, fee];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_FEES_KEY, next);
      setFees(allFees(next, overrides));
      resetForm();
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("fees").insert({
      student_id: newStudent,
      school_id: schoolId,
      term: 1,
      description: newDescription.trim(),
      amount_due: amount,
      amount_paid: 0,
      due_date: newDueDate,
      status: "due",
    });
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    await loadRealFees();
    resetForm();
  };

  const resetForm = () => {
    setNewStudent("");
    setNewDescription("Term 1 tuition");
    setNewAmount("");
    setNewDueDate("");
    setShowForm(false);
  };

  // A payment is entered as "how much came in now", not as a new running
  // total — that's how it arrives at the desk, and it keeps a part payment
  // from being mistyped as a smaller total than what's already been paid.
  const recordPayment = async (fee: DemoFee) => {
    const amount = Number(payAmount);
    if (!amount) return;
    const amountPaid = Math.min(fee.amountDue, fee.amountPaid + amount);

    if (isDemo) {
      const next = { ...overrides, [fee.id]: { ...overrides[fee.id], amountPaid } };
      setOverrides(next);
      writeDemoStore(DEMO_FEE_OVERRIDES_KEY, next);
      setFees(allFees(created, next));
      setOpenId(null);
      setPayAmount("");
      return;
    }

    await supabase
      .from("fees")
      .update({
        amount_paid: amountPaid,
        status: feeStatus({ amountDue: fee.amountDue, amountPaid }),
      })
      .eq("id", fee.id);
    await loadRealFees();
    setOpenId(null);
    setPayAmount("");
  };

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";

  const billed = fees.reduce((sum, f) => sum + f.amountDue, 0);
  const collected = fees.reduce((sum, f) => sum + f.amountPaid, 0);
  const outstanding = billed - collected;
  const unpaidCount = fees.filter((f) => feeStatus(f) !== "paid").length;

  const sorted = [...fees].sort((a, b) => {
    const rank = { due: 0, partial: 1, paid: 2 } as const;
    const byStatus = rank[feeStatus(a)] - rank[feeStatus(b)];
    return byStatus !== 0 ? byStatus : a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Finance"
        title="Payments"
        meta={[`${money(collected)} collected`, `${money(outstanding)} outstanding`]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? "Cancel" : "+ Record fee"}
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={money(billed)} label="Billed" sub={`${fees.length} charges`} />
        <StatTile value={money(collected)} label="Collected" sub="received to date" />
        <StatTile value={money(outstanding)} label="Outstanding" sub="still owed" />
        <StatTile value={unpaidCount} label="Unpaid" sub={unpaidCount === 1 ? "charge" : "charges"} />
      </div>

      {showForm && (
        <form onSubmit={addFee} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Student *</label>
            <select
              value={newStudent}
              onChange={(e) => setNewStudent(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Description *</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Term 1 tuition"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="300"
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Due date *</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
          </div>
          {formError && <p className="text-sm text-status-error-text">{formError}</p>}
          <button
            type="submit"
            disabled={!newStudent || !newAmount || !newDueDate || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? "Saving…" : "Record fee"}
          </button>
        </form>
      )}

      <SectionCard title="All charges" note={`${fees.length} total`}>
        {!ready ? (
          <LoadingNote />
        ) : sorted.length === 0 ? (
          <EmptyNote>No fees recorded yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {sorted.map((f) => {
              const status = feeStatus(f);
              const isOpen = openId === f.id;
              const remaining = f.amountDue - f.amountPaid;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(isOpen ? null : f.id);
                      setPayAmount("");
                    }}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                      {initials(studentName(f.studentId))}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{studentName(f.studentId)}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {f.description} · due {f.dueDate}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {money(f.amountPaid)} <span className="text-ink-muted font-normal">/ {money(f.amountDue)}</span>
                      </p>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${FEE_STATUS_STYLES[status]}`}>
                        {FEE_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                      {status === "paid" ? (
                        <p className="text-[13px] text-ink-muted">
                          Paid in full on {f.dueDate}. Nothing outstanding.
                        </p>
                      ) : (
                        <>
                          <p className="text-[13px] text-ink-muted">
                            {money(remaining)} still outstanding.
                          </p>
                          <div>
                            <label className="block text-xs font-semibold text-ink mb-1.5">Payment received</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max={remaining}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder={String(remaining)}
                              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => recordPayment(f)}
                              disabled={!Number(payAmount)}
                              className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
                            >
                              Record payment
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayAmount(String(remaining))}
                              className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                            >
                              Paid in full
                            </button>
                          </div>
                        </>
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
