"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CHILDREN,
  DEMO_CREATED_FEES_KEY,
  DEMO_FEE_OVERRIDES_KEY,
  allFees,
  feeStatus,
  formatDay,
  money,
  FEE_STATUS_STYLES,
  type DemoFee,
  type FeeOverride,
  type DemoStudent,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { balanceFor, balancesByStudent } from "@/lib/balances";
import { monthOf, todayIso } from "@/lib/finance";
import { myChildIds } from "@/hooks/useMyChildren";

export default function ParentPaymentsPage() {
  const supabase = createClient();
  const { t, language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [fees, setFees] = useState<DemoFee[]>([]);
  const [children, setChildren] = useState<DemoStudent[]>([]);

  useEffect(() => {
    const load = async () => {
      const user = await sessionUser(supabase);

      if (!user) {
        const c = readDemoStore<DemoFee[]>(DEMO_CREATED_FEES_KEY, []);
        const o = readDemoStore<Record<string, FeeOverride>>(DEMO_FEE_OVERRIDES_KEY, {});
        const childIds = new Set(DEMO_CHILDREN.map((s) => s.id));
        setFees(allFees(c, o).filter((f) => childIds.has(f.studentId)));
        setChildren(DEMO_CHILDREN);
        return;
      }

      // RLS already limits both tables to this parent's own children, so
      // neither query needs a filter of its own.
      // Their own children — for a teacher or admin in parent mode, not the
      // school's.
      const ids = await myChildIds(supabase);
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");
      setChildren((studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "" })));

      const { data } = await supabase
        .from("fees")
        .select("id, student_id, description, amount_due, amount_paid, due_date, term")
        .in("student_id", ids)
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
    load().finally(() => setReady(true));
  }, []);

  const childName = (id: string) => children.find((s) => s.id === id)?.name ?? t("common.yourChild");

  const billed = fees.reduce((sum, f) => sum + f.amountDue, 0);
  const paid = fees.reduce((sum, f) => sum + f.amountPaid, 0);
  // Seen from this month: unpaid from earlier months, this month's, and both.
  const month = monthOf(todayIso());
  const balance = balanceFor(fees, month);
  const outstanding = balance.outstanding;
  const perChild = balancesByStudent(fees, month);

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={t("common.fees")}
        title={t("nav.payments")}
        meta={
          outstanding > 0
            ? [`${money(outstanding)} ${t("common.outstanding").toLowerCase()}`]
            : [t("common.allPaidUp")]
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-section="balances">
        <StatTile value={money(balance.old)} label={t("parent.payments.oldBalance")} sub={t("parent.payments.fromEarlierMonths")} />
        <StatTile value={money(balance.monthOwed)} label={t("parent.payments.monthlyBalance")} sub={t("parent.payments.owedThisMonth")} />
        <StatTile value={money(balance.outstanding)} label={t("parent.payments.outstandingBalance")} sub={t("parent.payments.oldPlusMonthly")} />
      </div>
      <p className="text-[12px] text-ink-muted px-1" dir="auto">
        {money(paid)} {t("common.paid").toLowerCase()} · {money(billed)} {t("common.billed").toLowerCase()} · {countLabel("{count} charge|{count} charges", fees.length, `${fees.length} ${t("common.charges")}`)}
        {balance.upcoming > 0 && ` · ${money(balance.upcoming)} ${t("parent.payments.notDueYet")}`}
      </p>

      {perChild.length > 1 && (
        <SectionCard title={t("parent.payments.byChild")}>
          <ul className="divide-y divide-surface-border -my-1" data-section="by-child">
            {perChild.map((b) => (
              <li key={b.studentId} className="py-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{childName(b.studentId)}</p>
                <p className="text-[12px] text-ink-muted text-end" dir="ltr">
                  {t("parent.payments.oldBalance")} {money(b.old)} · {t("parent.payments.monthlyBalance")} {money(b.monthOwed)} ·{" "}
                  <span className={`font-semibold ${b.outstanding > 0 ? "text-red-800 dark:text-red-300" : "text-ink"}`}>
                    {t("parent.payments.outstandingBalance")} {money(b.outstanding)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title={t("common.yourCharges")} note={countLabel("{count} total", fees.length, `${fees.length} ${t("common.total")}`)}>
        {!ready ? (
          <LoadingNote />
        ) : fees.length === 0 ? (
          <EmptyNote>{t("common.nothingBilledYet")}</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {fees.map((f) => {
              const status = feeStatus(f);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{f.description}</p>
                    <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                      {childName(f.studentId)} · {t("common.due").toLowerCase()} {formatDay(f.dueDate, language)}
                    </p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-[13px] font-semibold text-ink" dir="ltr">
                      {money(f.amountPaid)} <span className="text-ink-muted font-normal">/ {money(f.amountDue)}</span>
                    </p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${FEE_STATUS_STYLES[status]}`}>
                      {t(`common.${status}`)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="text-[11px] text-ink-muted px-1">{t("parent.payments.footerNote")}</p>
    </div>
  );
}
