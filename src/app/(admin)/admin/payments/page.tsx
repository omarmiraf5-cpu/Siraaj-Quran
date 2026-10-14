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
import { SectionCard, StatTile, EmptyNote, LoadingNote, RowChevron } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { SalariesPanel } from "@/components/SalariesPanel";
import { ExpensesPanel } from "@/components/ExpensesPanel";
import { FinanceOverview } from "@/components/FinanceOverview";
import { balanceFor } from "@/lib/balances";
import { monthOf, todayIso } from "@/lib/finance";
import { useLanguage } from "@/components/LanguageProvider";
import { SegmentedControl } from "@/components/SegmentedControl";
import { phrase } from "@/lib/i18n/phrases";
import { useToast } from "@/components/Toast";

type Tab = "overview" | "fees" | "salaries" | "expenses";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", get label() { return phrase("Overview"); } },
  { id: "fees", get label() { return phrase("Fees"); } },
  { id: "salaries", get label() { return phrase("Salaries"); } },
  { id: "expenses", get label() { return phrase("Expenses"); } },
];
const TAB_KEY = "payments_tab";

export default function AdminPaymentsPage() {
  const { tr } = useLanguage();
  const toast = useToast();
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // The tab the office was last on, on this device.
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === "fees" || saved === "salaries" || saved === "expenses") setTab(saved);
    } catch {
      /* private mode */
    }
  }, []);
  const chooseTab = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* private mode */
    }
  };

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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // A school of a few hundred has a few hundred charges a term: the list is
  // searched and narrowed rather than scrolled.
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "unpaid" | "partial" | "paid">("all");

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

      setUserId(user.id);
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
      setFormError(tr(error.message));
      return;
    }
    await loadRealFees();
    resetForm();
    toast.success(tr("Fee recorded."));
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
    // More than is owed is refused, not quietly cut down: the desk has
    // either mistyped or taken too much, and either way should know.
    if (!amount || amount < 0 || amount > fee.amountDue - fee.amountPaid || paying) return;
    const amountPaid = fee.amountPaid + amount;
    setPayError(null);

    if (isDemo) {
      const next = { ...overrides, [fee.id]: { ...overrides[fee.id], amountPaid } };
      setOverrides(next);
      writeDemoStore(DEMO_FEE_OVERRIDES_KEY, next);
      setFees(allFees(created, next));
      setOpenId(null);
      setPayAmount("");
      toast.success(tr("Payment of {amount} recorded for {name}.", { amount: money(amount), name: studentName(fee.studentId) }));
      return;
    }

    setPaying(true);
    try {
      const { error } = await supabase
        .from("fees")
        .update({
          amount_paid: amountPaid,
          status: feeStatus({ amountDue: fee.amountDue, amountPaid }),
        })
        .eq("id", fee.id);
      if (error) throw error;
      await loadRealFees();
      setOpenId(null);
      setPayAmount("");
      toast.success(tr("Payment of {amount} recorded for {name}.", { amount: money(amount), name: studentName(fee.studentId) }));
    } catch {
      // The form stays open with the amount still in it, ready to retry.
      const message = navigator.onLine
        ? tr("The payment wasn't saved. Please try again.")
        : tr("You're offline. The payment wasn't saved — try again when you have signal.");
      setPayError(message);
      toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? phrase("Unknown student");

  const billed = fees.reduce((sum, f) => sum + f.amountDue, 0);
  const collected = fees.reduce((sum, f) => sum + f.amountPaid, 0);
  const outstanding = billed - collected;
  const unpaidCount = fees.filter((f) => feeStatus(f) !== "paid").length;

  const counts = {
    all: fees.length,
    unpaid: fees.filter((f) => feeStatus(f) === "due").length,
    partial: fees.filter((f) => feeStatus(f) === "partial").length,
    paid: fees.filter((f) => feeStatus(f) === "paid").length,
  };
  const needle = query.trim().toLocaleLowerCase();
  const sorted = fees
    .filter((f) => show === "all" || feeStatus(f) === (show === "unpaid" ? "due" : show))
    .filter((f) => !needle || `${studentName(f.studentId)} ${f.description}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => {
    const rank = { due: 0, partial: 1, paid: 2 } as const;
    const byStatus = rank[feeStatus(a)] - rank[feeStatus(b)];
    return byStatus !== 0 ? byStatus : a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Finance")}
        title={tr("Payments")}
        meta={
          tab === "fees"
            ? [tr("{amount} collected", { amount: money(collected) }), tr("{amount} outstanding", { amount: money(outstanding) })]
            : tab === "overview"
              ? [tr("{amount} outstanding", { amount: money(balanceFor(fees, monthOf(todayIso())).outstanding) }), tr("Fees, salaries and expenses together")]
              : [tab === "salaries" ? tr("What the school pays its staff") : tr("What the school spends")]
        }
        actions={
          tab === "fees" ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
            >
              {showForm ? tr("Cancel") : tr("+ Record fee")}
            </button>
          ) : undefined
        }
      />

      <SegmentedControl
        role="tablist"
        label={tr("Payments")}
        value={tab}
        onChange={chooseTab}
        options={TABS.map((t) => ({ value: t.id, label: t.label }))}
      />

      {tab === "overview" && <FinanceOverview isDemo={isDemo} fees={fees} students={students} feesReady={ready} />}
      {tab === "salaries" && ready && <SalariesPanel isDemo={isDemo} schoolId={schoolId} userId={userId} />}
      {tab === "expenses" && ready && <ExpensesPanel isDemo={isDemo} schoolId={schoolId} userId={userId} />}

      {tab === "fees" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile value={money(billed)} label={tr("Billed")} sub={tr("{count} charges", { count: fees.length })} />
            <StatTile value={money(collected)} label={tr("Collected")} sub={tr("received to date")} />
            <StatTile value={money(outstanding)} label={tr("Outstanding")} sub={tr("still owed")} />
            <StatTile value={unpaidCount} label={tr("Unpaid")} sub={tr("charge|charges", { count: unpaidCount })} />
          </div>

          {showForm && (
            <form onSubmit={addFee} className="card-quiet p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{tr("Student *")}</label>
                <select
                  value={newStudent}
                  onChange={(e) => setNewStudent(e.target.value)}
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                >
                  <option value="">{tr("Choose a student…")}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{tr("Description *")}</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={tr("e.g. Term 1 tuition")}
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">{tr("Amount *")}</label>
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
                  <label className="block text-sm font-semibold text-ink mb-2">{tr("Due date *")}</label>
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
                {saving ? tr("Saving…") : tr("Record fee")}
              </button>
            </form>
          )}

          <SectionCard
            title={tr("All charges")}
            note={sorted.length === fees.length ? tr("{count} total", { count: fees.length }) : tr("{shown} of {count}", { shown: sorted.length, count: fees.length })}
          >
            {ready && fees.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr("Search by student or charge")}
                  aria-label={tr("Search by student or charge")}
                  className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
                <div role="group" aria-label={tr("Show")} className="flex flex-wrap gap-1.5">
                  {(["all", "unpaid", "partial", "paid"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={show === k}
                      onClick={() => setShow(k)}
                      className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        show === k
                          ? "border-brand-navy bg-brand-navy text-white"
                          : "border-surface-border text-ink-muted hover:text-ink"
                      }`}
                    >
                      {k === "all" ? tr("All") : FEE_STATUS_LABELS[k === "unpaid" ? "due" : k]}{" "}
                      <span className="tabular-nums opacity-75">{counts[k]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!ready ? (
              <LoadingNote />
            ) : fees.length === 0 ? (
              <EmptyNote>{tr("No fees recorded yet.")}</EmptyNote>
            ) : sorted.length === 0 ? (
              <div className="py-2">
                <EmptyNote>{tr("No charges match.")}</EmptyNote>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setShow("all");
                  }}
                  className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {tr("Clear search and filters")}
                </button>
              </div>
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
                          setPayError(null);
                        }}
                        aria-expanded={isOpen}
                        className="group w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                      >
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                          {initials(studentName(f.studentId))}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{studentName(f.studentId)}</p>
                          <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                            {tr("{description} · due {dueDate}", { description: f.description, dueDate: f.dueDate })}
                          </p>
                        </div>
                        <div className="text-end flex-shrink-0">
                          <p className="text-[13px] font-semibold text-ink">
                            {money(f.amountPaid)} <span className="text-ink-muted font-normal">/ {money(f.amountDue)}</span>
                          </p>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${FEE_STATUS_STYLES[status]}`}>
                            {FEE_STATUS_LABELS[status]}
                          </span>
                        </div>
                        <RowChevron open={isOpen} />
                      </button>

                      {isOpen && (
                        <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                          {status === "paid" ? (
                            <p className="text-[13px] text-ink-muted">
                              {tr("Paid in full on {dueDate}. Nothing outstanding.", { dueDate: f.dueDate })}
                            </p>
                          ) : (
                            <>
                              <p className="text-[13px] text-ink-muted">
                                {tr("{amount} still outstanding.", { amount: money(remaining) })}
                              </p>
                              <div>
                                <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Payment received")}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={remaining}
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  placeholder={String(remaining)}
                                  aria-invalid={Number(payAmount) > remaining}
                                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                                />
                                {Number(payAmount) > remaining && (
                                  <p className="text-[12px] text-status-error-text mt-1.5">
                                    {tr("That's more than the {amount} still owed.", { amount: money(remaining) })}
                                  </p>
                                )}
                              </div>
                              {payError && <p className="text-[12px] text-status-error-text">{payError}</p>}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => recordPayment(f)}
                                  disabled={!(Number(payAmount) > 0) || Number(payAmount) > remaining || paying}
                                  className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
                                >
                                  {paying ? tr("Saving…") : tr("Record payment")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPayAmount(String(remaining))}
                                  className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                                >
                                  {tr("Paid in full")}
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
        </>
      )}
    </div>
  );
}
