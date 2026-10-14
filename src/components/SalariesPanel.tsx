"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolTeachers } from "@/lib/schoolTeachers";
import {
  allTeachers,
  DEMO_CREATED_TEACHERS_KEY,
  DEMO_TEACHER_OVERRIDES_KEY,
  initials,
  money,
  type DemoTeacher,
  type TeacherOverride,
} from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { MonthBar, field, label, primary, ghost } from "@/components/financeUi";
import {
  PAY_METHOD_LABELS,
  SALARY_METHODS,
  monthOf,
  financeProblem,
  parseAmount,
  shiftMonth,
  shortDate,
  sum,
  todayIso,
  type PayMethod,
  type SalaryPayment,
} from "@/lib/finance";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

// The month's salaries: every admin and teacher with their usual monthly
// pay, who's been paid and who hasn't, and anyone else the school pays.

const DEMO_PAYMENTS_KEY = "demo_salary_payments";
const DEMO_RATES_KEY = "demo_pay_rates";

interface Draft {
  amount: string;
  paidOn: string;
  method: PayMethod;
  note: string;
}
const blankDraft = (amount = ""): Draft => ({ amount, paidOn: todayIso(), method: "cash", note: "" });

function demoSeed(staff: DemoTeacher[], thisMonth: string) {
  const rates: Record<string, number> = {};
  staff.forEach((s, i) => (rates[s.id] = [1200, 900, 750][i % 3]));
  const last = shiftMonth(thisMonth, -1);
  const payments: SalaryPayment[] = staff.map((s, i) => ({
    id: `demo-pay-${s.id}`,
    staffId: s.id,
    payeeName: s.name,
    payMonth: last,
    amount: rates[s.id],
    paidOn: `${last.slice(0, 7)}-28`,
    method: i % 2 ? "cash" : "e_transfer",
    note: null,
  }));
  return { rates, payments };
}

/** The sample school's salary payments, as the Salaries tab keeps them. */
export function demoSalaryPayments(thisMonth: string): SalaryPayment[] {
  const people = allTeachers(
    readDemoStore(DEMO_CREATED_TEACHERS_KEY, []),
    readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {})
  );
  return readDemoStore<SalaryPayment[]>(DEMO_PAYMENTS_KEY, demoSeed(people, thisMonth).payments);
}

export function SalariesPanel({ isDemo, schoolId, userId }: { isDemo: boolean; schoolId: string | null; userId: string | null }) {
  const { tr } = useLanguage();
  const supabase = createClient();
  const thisMonth = monthOf(todayIso());
  const [month, setMonth] = useState(thisMonth);
  const [staff, setStaff] = useState<DemoTeacher[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [ready, setReady] = useState(false);
  // Why the tab can't load, if it can't.
  const [notReady, setNotReady] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [rateDraft, setRateDraft] = useState("");
  const [other, setOther] = useState<(Draft & { name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Everyone the school pays, and what they usually get.
  useEffect(() => {
    const load = async () => {
      if (isDemo) {
        const people = allTeachers(
          readDemoStore(DEMO_CREATED_TEACHERS_KEY, []),
          readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {})
        );
        setStaff(people);
        const seed = demoSeed(people, thisMonth);
        setRates(readDemoStore(DEMO_RATES_KEY, seed.rates));
        return;
      }
      const [people, { data: rateRows, error: ratesError }] = await Promise.all([
        loadSchoolTeachers(supabase, { everyAdmin: true }),
        supabase.from("staff_pay_rates").select("staff_id, monthly_amount"),
      ]);
      if (ratesError) setNotReady(financeProblem(ratesError, "Salaries"));
      setStaff(people.filter((p) => p.active !== false));
      setRates(Object.fromEntries((rateRows ?? []).map((r) => [r.staff_id as string, Number(r.monthly_amount)])));
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const loadPayments = async (m: string) => {
    if (isDemo) {
      const all = readDemoStore<SalaryPayment[]>(DEMO_PAYMENTS_KEY, demoSeed(staff, thisMonth).payments);
      setPayments(all.filter((p) => p.payMonth === m));
      return;
    }
    const { data, error: loadError } = await supabase
      .from("salary_payments")
      .select("id, staff_id, payee_name, pay_month, amount, paid_on, method, note")
      .eq("pay_month", m)
      .order("paid_on");
    if (loadError) {
      setNotReady(financeProblem(loadError, "Salaries"));
      return;
    }
    setPayments(
      (data ?? []).map((p) => ({
        id: p.id,
        staffId: p.staff_id,
        payeeName: p.payee_name,
        payMonth: p.pay_month,
        amount: Number(p.amount),
        paidOn: p.paid_on,
        method: p.method,
        note: p.note,
      }))
    );
  };

  useEffect(() => {
    if (isDemo && staff.length === 0) return;
    setReady(false);
    loadPayments(month).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isDemo, staff.length]);

  const paidTo = (id: string) => payments.filter((p) => p.staffId === id);
  const others = payments.filter((p) => !p.staffId || !staff.some((s) => s.id === p.staffId));
  const paidTotal = sum(payments.map((p) => p.amount));
  const unpaid = staff.filter((s) => paidTo(s.id).length === 0);
  const stillToPay = sum(unpaid.map((s) => rates[s.id] ?? 0));
  const noRate = unpaid.filter((s) => !rates[s.id]).length;

  // What's left of their usual salary this month, to fill in the amount.
  const leftFor = (id: string, list = payments) => {
    const left = sum([rates[id] ?? 0, ...list.filter((p) => p.staffId === id).map((p) => -p.amount)]);
    return left > 0 ? String(left) : "";
  };

  const open = (s: DemoTeacher) => {
    if (openId === s.id) {
      setOpenId(null);
      return;
    }
    setOpenId(s.id);
    setError(null);
    setRateDraft(rates[s.id] ? String(rates[s.id]) : "");
    setDraft(blankDraft(leftFor(s.id)));
  };

  const saveRate = async (s: DemoTeacher) => {
    const amount = rateDraft.trim() === "" ? 0 : parseAmount(rateDraft);
    if (amount === null) {
      setError(tr("Enter their monthly salary as an amount, like 1200."));
      return;
    }
    setBusy(true);
    setError(null);
    if (isDemo) {
      const next = { ...rates, [s.id]: amount };
      setRates(next);
      writeDemoStore(DEMO_RATES_KEY, next);
    } else {
      const { error: saveError } = await supabase
        .from("staff_pay_rates")
        .upsert({ school_id: schoolId, staff_id: s.id, monthly_amount: amount, updated_at: new Date().toISOString() }, { onConflict: "school_id,staff_id" });
      if (saveError) setError(tr(saveError.message));
      else setRates({ ...rates, [s.id]: amount });
    }
    if (!draft.amount && amount) setDraft({ ...draft, amount: String(amount) });
    setBusy(false);
  };

  const record = async (payee: { staffId: string | null; name: string }, d: Draft) => {
    const amount = parseAmount(d.amount);
    if (amount === null) {
      setError(tr("Enter the amount paid, like 1200."));
      return false;
    }
    if (!payee.name.trim()) {
      setError(tr("Who was paid?"));
      return false;
    }
    setBusy(true);
    setError(null);
    const row: SalaryPayment = {
      id: `local-pay-${Date.now()}`,
      staffId: payee.staffId,
      payeeName: payee.name.trim(),
      payMonth: month,
      amount,
      paidOn: d.paidOn || todayIso(),
      method: d.method,
      note: d.note.trim() || null,
    };
    if (isDemo) {
      const all = readDemoStore<SalaryPayment[]>(DEMO_PAYMENTS_KEY, demoSeed(staff, thisMonth).payments);
      writeDemoStore(DEMO_PAYMENTS_KEY, [...all, row]);
    } else {
      const { error: saveError } = await supabase.from("salary_payments").insert({
        school_id: schoolId,
        staff_id: row.staffId,
        payee_name: row.payeeName,
        pay_month: row.payMonth,
        amount: row.amount,
        paid_on: row.paidOn,
        method: row.method,
        note: row.note,
        created_by: userId,
      });
      if (saveError) {
        setError(tr(saveError.message));
        setBusy(false);
        return false;
      }
    }
    await loadPayments(month);
    setBusy(false);
    return true;
  };

  const undo = async (p: SalaryPayment) => {
    if (!window.confirm(tr("Remove the {amount} paid to {payeeName} on {shortDate}?", { amount: money(p.amount), payeeName: p.payeeName, shortDate: shortDate(p.paidOn) }))) return;
    if (isDemo) {
      const all = readDemoStore<SalaryPayment[]>(DEMO_PAYMENTS_KEY, demoSeed(staff, thisMonth).payments);
      writeDemoStore(
        DEMO_PAYMENTS_KEY,
        all.filter((x) => x.id !== p.id)
      );
    } else {
      const { error: deleteError } = await supabase.from("salary_payments").delete().eq("id", p.id);
      if (deleteError) {
        setError(tr(deleteError.message));
        return;
      }
    }
    await loadPayments(month);
  };

  // Render helpers, not components: a component made here would be a new
  // one each render, and its inputs would lose focus at every keystroke.
  const paymentLine = (p: SalaryPayment) => (
    <li key={p.id} className="flex items-start justify-between gap-3 text-[12.5px]">
      <span className="text-ink">
        <strong>{money(p.amount)}</strong>{" "}{tr("on {shortDate} · {PAY_METHOD_LABELS}", { shortDate: shortDate(p.paidOn), PAY_METHOD_LABELS: PAY_METHOD_LABELS[p.method] })}
        {p.note && <span className="text-ink-muted"> · {p.note}</span>}
      </span>
      <button type="button" onClick={() => undo(p)} className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline flex-shrink-0">
        {tr("Undo")}
      </button>
    </li>
  );

  const payForm = (d: Draft, setD: (d: Draft) => void, onSave: () => void, submit: string) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{tr("Amount *")}</label>
          <input inputMode="decimal" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} placeholder="1200" className={field} />
        </div>
        <div>
          <label className={label}>{tr("Paid on")}</label>
          <input type="date" value={d.paidOn} onChange={(e) => setD({ ...d, paidOn: e.target.value })} className={field} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{tr("How")}</label>
          <select value={d.method} onChange={(e) => setD({ ...d, method: e.target.value as PayMethod })} className={field}>
            {SALARY_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAY_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{tr("Note")}</label>
          <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder={tr("Optional")} maxLength={300} className={field} />
        </div>
      </div>
      <button type="button" onClick={onSave} disabled={busy || !d.amount} className={`${primary} w-full`}>
        {busy ? tr("Saving…") : submit}
      </button>
    </div>
  );

  if (notReady) {
    return (
      <SectionCard title={tr("Salaries")}>
        <EmptyNote>{notReady}</EmptyNote>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-quiet p-4">
        <MonthBar month={month} onChange={(m) => { setMonth(m); setOpenId(null); setOther(null); }} thisMonth={thisMonth} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile value={money(paidTotal)} label={tr("Paid")} sub={tr("{count} payment|{count} payments", { count: payments.length })} />
        <StatTile
          value={money(stillToPay)}
          label={tr("Still to pay")}
          sub={noRate > 0 ? tr("{noRate} with no salary set", { noRate }) : unpaid.length === 0 ? tr("everyone's paid") : tr("{count} to go", { count: unpaid.length })}
        />
        <StatTile value={`${staff.length - unpaid.length} of ${staff.length}`} label={tr("Staff paid")} sub={tr("this month")} />
      </div>

      <SectionCard title={tr("Staff")} note={tr("{count} on staff", { count: staff.length })}>
        {!ready ? (
          <LoadingNote />
        ) : staff.length === 0 ? (
          <EmptyNote>{tr("No teachers yet. Add them under Teachers.")}</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {staff.map((s) => {
              const theirs = paidTo(s.id);
              const paid = sum(theirs.map((p) => p.amount));
              const isOpen = openId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => open(s)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                      {initials(s.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">
                        {s.name}
                        {s.admin && <span className="ms-1.5 text-[10px] font-semibold text-ink-muted uppercase tracking-wide">{tr("Admin")}</span>}
                      </p>
                      <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                        {rates[s.id] ? tr("{amount} a month", { amount: money(rates[s.id]) }) : tr("No salary set")}
                      </p>
                    </div>
                    <div className="text-end flex-shrink-0">
                      {theirs.length > 0 ? (
                        <>
                          <p className="text-[13px] font-semibold text-ink">{money(paid)}</p>
                          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 bg-status-success-bg text-status-success-text">
                            {tr("Paid {shortDate}", { shortDate: shortDate(theirs[theirs.length - 1].paidOn) })}
                          </span>
                        </>
                      ) : (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warning-bg text-status-warning-text">
                          {tr("Not paid yet")}
                        </span>
                      )}
                    </div>
                    <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                      <IconArrow size={14} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-4">
                      {theirs.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-ink mb-1.5">{tr("Paid this month")}</p>
                          <ul className="space-y-1.5">
                            {theirs.map((p) => paymentLine(p))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-ink mb-1.5">{theirs.length > 0 ? tr("Pay more") : tr("Pay their salary")}</p>
                        {payForm(
                          draft,
                          setDraft,
                          async () => {
                            const amount = parseAmount(draft.amount) ?? 0;
                            if (await record({ staffId: s.id, name: s.name }, draft)) {
                              setDraft(blankDraft(leftFor(s.id, [...payments, { staffId: s.id, amount } as SalaryPayment])));
                            }
                          },
                          phrase("Record payment")
                        )}
                      </div>
                      <div className="pt-3 border-t border-surface-border">
                        <label className={label}>{tr("Usual monthly salary")}</label>
                        <div className="flex gap-2">
                          <input inputMode="decimal" value={rateDraft} onChange={(e) => setRateDraft(e.target.value)} placeholder="e.g. 1200" className={field} />
                          <button type="button" onClick={() => saveRate(s)} disabled={busy} className={ghost}>
                            {tr("Save")}
                          </button>
                        </div>
                        <p className="text-[11px] text-ink-muted mt-1">{tr("Filled in each time you pay them; you can still change the amount.")}</p>
                      </div>
                      {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={tr("Others paid")} note={tr("without a MyDiiwaan login")}>
        <div className="space-y-3">
          {others.length === 0 && !other && <EmptyNote>{tr("Nobody else paid this month.")}</EmptyNote>}
          {others.length > 0 && (
            <ul className="space-y-2">
              {others.map((p) => (
                <li key={p.id} className="rounded-xl border border-surface-border bg-surface-card px-3 py-2">
                  <p className="text-[13px] font-semibold text-ink">{p.payeeName}</p>
                  <ul>{paymentLine(p)}</ul>
                </li>
              ))}
            </ul>
          )}
          {other ? (
            <div className="rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
              <div>
                <label className={label}>{tr("Who *")}</label>
                <input value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} placeholder={tr("e.g. Abdi (cleaner)")} maxLength={120} className={field} />
              </div>
              {payForm(
                other,
                (d) => setOther({ ...other, ...d }),
                async () => {
                  if (await record({ staffId: null, name: other.name }, other)) setOther(null);
                },
                phrase("Record payment")
              )}
              <button type="button" onClick={() => setOther(null)} className="text-[13px] font-semibold text-ink-muted hover:text-ink">
                {tr("Cancel")}
              </button>
              {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => { setOther({ ...blankDraft(), name: "" }); setError(null); }} className={ghost}>
              {tr("+ Pay someone else")}
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
