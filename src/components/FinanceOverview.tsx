"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials, money, type DemoFee, type DemoStudent } from "@/data/demo";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { MonthBar } from "@/components/financeUi";
import { demoSalaryPayments } from "@/components/SalariesPanel";
import { demoExpenses } from "@/components/ExpensesPanel";
import { financeProblem, monthLabel, monthOf, sum, todayIso } from "@/lib/finance";
import { balanceFor, balancesByStudent } from "@/lib/balances";

// The office's money on one page: fees, salaries and expenses — for a month
// and in all — and what families owe: the old balance, the month's fees,
// and the outstanding balance, school-wide and student by student.

interface Dated {
  amount: number;
  /** The month it belongs to, YYYY-MM-01. */
  month: string;
}

export function FinanceOverview({
  isDemo,
  fees,
  students,
  feesReady,
}: {
  isDemo: boolean;
  fees: DemoFee[];
  students: DemoStudent[];
  feesReady: boolean;
}) {
  const supabase = createClient();
  const thisMonth = monthOf(todayIso());
  const [month, setMonth] = useState(thisMonth);
  const [salaries, setSalaries] = useState<Dated[]>([]);
  const [expenses, setExpenses] = useState<Dated[]>([]);
  const [ready, setReady] = useState(false);
  // Why salaries or expenses couldn't be counted, if they couldn't.
  const [problem, setProblem] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (isDemo) {
        setSalaries(demoSalaryPayments(thisMonth).map((p) => ({ amount: p.amount, month: p.payMonth })));
        setExpenses(demoExpenses(thisMonth).map((e) => ({ amount: e.amount, month: monthOf(e.spentOn) })));
        return;
      }
      const [pay, spent] = await Promise.all([
        supabase.from("salary_payments").select("amount, pay_month"),
        supabase.from("expenses").select("amount, spent_on"),
      ]);
      if (pay.error) setProblem(financeProblem(pay.error, "Salaries"));
      else if (spent.error) setProblem(financeProblem(spent.error, "Expenses"));
      setSalaries((pay.data ?? []).map((p) => ({ amount: Number(p.amount), month: monthOf(p.pay_month as string) })));
      setExpenses((spent.data ?? []).map((e) => ({ amount: Number(e.amount), month: monthOf(e.spent_on as string) })));
    };
    load().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const inMonth = (xs: Dated[]) => sum(xs.filter((x) => x.month === month).map((x) => x.amount));
  const school = balanceFor(fees, month);
  const salariesMonth = inMonth(salaries);
  const expensesMonth = inMonth(expenses);
  const netMonth = school.monthPaid - salariesMonth - expensesMonth;

  const collected = sum(fees.map((f) => Math.min(f.amountPaid, f.amountDue)));
  const salariesAll = sum(salaries.map((x) => x.amount));
  const expensesAll = sum(expenses.map((x) => x.amount));
  const netAll = collected - salariesAll - expensesAll;

  const name = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";
  const rows = balancesByStudent(fees, month).filter((r) => r.outstanding > 0 || r.monthBilled > 0);
  const owing = rows.filter((r) => r.outstanding > 0);
  const shown = showAll ? rows : owing;

  if (!ready || !feesReady) return <LoadingNote />;

  const signed = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));

  return (
    <div className="space-y-4">
      <MonthBar month={month} onChange={setMonth} thisMonth={thisMonth} />

      {problem && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 p-4 text-[13px] text-amber-800 dark:text-amber-300">
          {problem}
        </div>
      )}

      <SectionCard title={`${monthLabel(month)} totals`} note="money in and out">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-section="month-totals">
          <StatTile value={money(school.monthPaid)} label="Fees" sub={`paid of ${money(school.monthBilled)} billed`} />
          <StatTile value={money(salariesMonth)} label="Salaries" sub="paid to staff" />
          <StatTile value={money(expensesMonth)} label="Expenses" sub="spent" />
          <StatTile value={signed(netMonth)} label="Left over" sub="fees − salaries − expenses" />
        </div>
      </SectionCard>

      <SectionCard title="All-time totals" note="since records began">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-section="all-totals">
          <StatTile value={money(collected)} label="Fees collected" sub={`of ${money(sum(fees.map((f) => f.amountDue)))} billed`} />
          <StatTile value={money(salariesAll)} label="Salaries" sub={`${salaries.length} payments`} />
          <StatTile value={money(expensesAll)} label="Expenses" sub={`${expenses.length} records`} />
          <StatTile value={signed(netAll)} label="Balance" sub="collected − paid out" />
        </div>
      </SectionCard>

      <SectionCard title="Fee balances" note={`as of ${monthLabel(month)}`}>
        <div className="grid grid-cols-3 gap-3" data-section="balances">
          <StatTile value={money(school.old)} label="Old balance" sub={`unpaid from before ${monthLabel(month)}`} />
          <StatTile value={money(school.monthOwed)} label="Monthly balance" sub={`still owed for ${monthLabel(month)}`} />
          <StatTile value={money(school.outstanding)} label="Outstanding" sub="old + monthly" />
        </div>
        {school.upcoming > 0 && (
          <p className="mt-3 text-[12px] text-ink-muted">
            {money(school.upcoming)} more is billed for after {monthLabel(month)} and isn&apos;t due yet.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Balance by student"
        note={`${owing.length} owing`}
      >
        {rows.length === 0 ? (
          <EmptyNote>No fees billed up to {monthLabel(month)}.</EmptyNote>
        ) : (
          <>
            {shown.length === 0 ? (
              <EmptyNote>Every student is paid up.</EmptyNote>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[13px]" data-section="by-student">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="text-start font-semibold py-2 px-1">Student</th>
                      <th className="text-end font-semibold py-2 px-1">Old</th>
                      <th className="text-end font-semibold py-2 px-1">This month</th>
                      <th className="text-end font-semibold py-2 px-1">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {shown.map((r) => (
                      <tr key={r.studentId}>
                        <td className="py-2 px-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                              {initials(name(r.studentId))}
                            </span>
                            <span className="font-semibold text-ink truncate">{name(r.studentId)}</span>
                          </span>
                        </td>
                        <td className="py-2 px-1 text-end tabular-nums text-ink-body" dir="ltr">{money(r.old)}</td>
                        <td className="py-2 px-1 text-end tabular-nums text-ink-body" dir="ltr">{money(r.monthOwed)}</td>
                        <td className={`py-2 px-1 text-end tabular-nums font-semibold ${r.outstanding > 0 ? "text-red-800 dark:text-red-300" : "text-ink"}`} dir="ltr">
                          {money(r.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > owing.length && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {showAll ? "Show only students who owe" : `Show paid-up students too (${rows.length - owing.length})`}
              </button>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-ink-muted">
          A charge counts in the month it&apos;s due. Anything still unpaid from earlier months is the old balance.
        </p>
      </SectionCard>
    </div>
  );
}
