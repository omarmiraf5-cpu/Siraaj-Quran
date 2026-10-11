"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { MonthBar, field, label, primary, ghost } from "@/components/financeUi";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_METHODS,
  PAY_METHOD_LABELS,
  monthEnd,
  monthOf,
  parseAmount,
  shiftMonth,
  shortDate,
  sum,
  todayIso,
  type Expense,
  type ExpenseCategory,
  type PayMethod,
} from "@/lib/finance";

// The month's spending: what, how much, to whom, by category.

const DEMO_EXPENSES_KEY = "demo_expenses";

function demoSeed(thisMonth: string): Expense[] {
  const at = (month: string, day: number) => `${month.slice(0, 7)}-${String(day).padStart(2, "0")}`;
  const last = shiftMonth(thisMonth, -1);
  return [
    { id: "demo-exp-1", spentOn: at(last, 1), category: "rent", description: "Rent for the hall", amount: 2500, paidTo: "Masjid committee", method: "cheque" },
    { id: "demo-exp-2", spentOn: at(last, 9), category: "supplies", description: "Mushafs and Qa'idah books", amount: 186.4, paidTo: "Islamic bookstore", method: "card" },
    { id: "demo-exp-3", spentOn: at(thisMonth, 1), category: "rent", description: "Rent for the hall", amount: 2500, paidTo: "Masjid committee", method: "cheque" },
    { id: "demo-exp-4", spentOn: at(thisMonth, 3), category: "utilities", description: "Internet", amount: 79.99, paidTo: null, method: "card" },
  ];
}

interface Draft {
  spentOn: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paidTo: string;
  method: PayMethod;
}
const blankDraft = (): Draft => ({ spentOn: todayIso(), category: "supplies", description: "", amount: "", paidTo: "", method: "cash" });

export function ExpensesPanel({ isDemo, schoolId, userId }: { isDemo: boolean; schoolId: string | null; userId: string | null }) {
  const supabase = createClient();
  const thisMonth = monthOf(todayIso());
  const [month, setMonth] = useState(thisMonth);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (m: string) => {
    if (isDemo) {
      const all = readDemoStore<Expense[]>(DEMO_EXPENSES_KEY, demoSeed(thisMonth));
      setExpenses(all.filter((e) => e.spentOn >= m && e.spentOn <= monthEnd(m)).sort((a, b) => b.spentOn.localeCompare(a.spentOn)));
      return;
    }
    const { data, error: loadError } = await supabase
      .from("expenses")
      .select("id, spent_on, category, description, amount, paid_to, method")
      .gte("spent_on", m)
      .lte("spent_on", monthEnd(m))
      .order("spent_on", { ascending: false });
    if (loadError) {
      setNotReady(true);
      return;
    }
    setExpenses(
      (data ?? []).map((e) => ({
        id: e.id,
        spentOn: e.spent_on,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        paidTo: e.paid_to,
        method: e.method,
      }))
    );
  };

  useEffect(() => {
    setReady(false);
    load(month).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isDemo]);

  const total = sum(expenses.map((e) => e.amount));
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ category: c, amount: sum(expenses.filter((e) => e.category === c).map((e) => e.amount)) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const save = async () => {
    if (!draft) return;
    const amount = parseAmount(draft.amount);
    if (amount === null) {
      setError("Enter the amount, like 79.99.");
      return;
    }
    if (!draft.description.trim()) {
      setError("What was it for?");
      return;
    }
    setBusy(true);
    setError(null);
    const row: Expense = {
      id: `local-exp-${Date.now()}`,
      spentOn: draft.spentOn || todayIso(),
      category: draft.category,
      description: draft.description.trim(),
      amount,
      paidTo: draft.paidTo.trim() || null,
      method: draft.method,
    };
    if (isDemo) {
      writeDemoStore(DEMO_EXPENSES_KEY, [...readDemoStore<Expense[]>(DEMO_EXPENSES_KEY, demoSeed(thisMonth)), row]);
    } else {
      const { error: saveError } = await supabase.from("expenses").insert({
        school_id: schoolId,
        spent_on: row.spentOn,
        category: row.category,
        description: row.description,
        amount: row.amount,
        paid_to: row.paidTo,
        method: row.method,
        created_by: userId,
      });
      if (saveError) {
        setError(saveError.message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setDraft(null);
    // To the month it was spent in, so it's there to see.
    if (monthOf(row.spentOn) !== month) setMonth(monthOf(row.spentOn));
    else await load(month);
  };

  const remove = async (e: Expense) => {
    if (!window.confirm(`Remove "${e.description}" (${money(e.amount)}) from ${shortDate(e.spentOn)}?`)) return;
    if (isDemo) {
      writeDemoStore(
        DEMO_EXPENSES_KEY,
        readDemoStore<Expense[]>(DEMO_EXPENSES_KEY, demoSeed(thisMonth)).filter((x) => x.id !== e.id)
      );
    } else {
      const { error: deleteError } = await supabase.from("expenses").delete().eq("id", e.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setOpenId(null);
    await load(month);
  };

  if (notReady) {
    return (
      <SectionCard title="Expenses">
        <EmptyNote>Expenses need the salaries and expenses update run in Supabase first (mydiiwaan-update-11.sql).</EmptyNote>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-quiet p-4">
        <MonthBar month={month} onChange={(m) => { setMonth(m); setOpenId(null); }} thisMonth={thisMonth} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile value={money(total)} label="Spent" sub={`${expenses.length} expense${expenses.length === 1 ? "" : "s"}`} />
        <StatTile
          value={byCategory[0] ? EXPENSE_CATEGORY_LABELS[byCategory[0].category] : "—"}
          label="Biggest"
          sub={byCategory[0] ? money(byCategory[0].amount) : "nothing yet"}
        />
        <div className="col-span-2 md:col-span-1 flex items-center">
          <button type="button" onClick={() => { setDraft(draft ? null : blankDraft()); setError(null); }} className={`${primary} w-full py-3`}>
            {draft ? "Cancel" : "+ Add expense"}
          </button>
        </div>
      </div>

      {draft && (
        <div className="card-quiet p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Date *</label>
              <input type="date" value={draft.spentOn} max={todayIso()} onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })} className={field} />
            </div>
            <div>
              <label className={label}>Category *</label>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })} className={field}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>What for *</label>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="e.g. Qa'idah books for Grade 1" maxLength={200} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Amount *</label>
              <input inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="79.99" className={field} />
            </div>
            <div>
              <label className={label}>How</label>
              <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as PayMethod })} className={field}>
                {EXPENSE_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAY_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Paid to</label>
            <input value={draft.paidTo} onChange={(e) => setDraft({ ...draft, paidTo: e.target.value })} placeholder="Optional, e.g. the bookstore" maxLength={120} className={field} />
          </div>
          {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}
          <button type="button" onClick={save} disabled={busy || !draft.amount || !draft.description.trim()} className={`${primary} w-full`}>
            {busy ? "Saving…" : "Save expense"}
          </button>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="card-quiet p-4">
          <p className="eyebrow mb-2">By category</p>
          <ul className="flex flex-wrap gap-2">
            {byCategory.map((c) => (
              <li key={c.category} className="text-[12.5px] rounded-full border border-surface-border bg-surface-card px-3 py-1 text-ink">
                {EXPENSE_CATEGORY_LABELS[c.category]} <strong>{money(c.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SectionCard title="Expenses" note={`${expenses.length} this month`}>
        {!ready ? (
          <LoadingNote />
        ) : expenses.length === 0 ? (
          <EmptyNote>Nothing spent this month yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {expenses.map((e) => {
              const isOpen = openId === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : e.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span className="w-12 text-center flex-shrink-0 text-[11px] font-semibold text-ink-muted">{shortDate(e.spentOn)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{e.description}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                        {e.paidTo ? ` · ${e.paidTo}` : ""} · {PAY_METHOD_LABELS[e.method]}
                      </p>
                    </div>
                    <p className="text-[13px] font-semibold text-ink flex-shrink-0">{money(e.amount)}</p>
                  </button>
                  {isOpen && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-3 flex items-center justify-between gap-3">
                      <p className="text-[12px] text-ink-muted">Entered by mistake?</p>
                      <button type="button" onClick={() => remove(e)} className={`${ghost} text-red-700 dark:text-red-300`}>
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && !draft && <p className="text-[12.5px] text-status-error-text mt-2">{error}</p>}
      </SectionCard>
    </div>
  );
}
