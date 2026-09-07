"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CHILDREN,
  DEMO_FEES,
  DEMO_CREATED_FEES_KEY,
  DEMO_FEE_OVERRIDES_KEY,
  allFees,
  feeStatus,
  money,
  FEE_STATUS_LABELS,
  FEE_STATUS_STYLES,
  type DemoFee,
  type FeeOverride,
  type DemoStudent,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote } from "@/components/portal-ui";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

export default function ParentPaymentsPage() {
  const supabase = createClient();
  const [fees, setFees] = useState<DemoFee[]>([]);
  const [children, setChildren] = useState<DemoStudent[]>(DEMO_CHILDREN);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const c = readDemoStore<DemoFee[]>(DEMO_CREATED_FEES_KEY, []);
        const o = readDemoStore<Record<string, FeeOverride>>(DEMO_FEE_OVERRIDES_KEY, {});
        const childIds = new Set(DEMO_CHILDREN.map((s) => s.id));
        setFees(allFees(c, o).filter((f) => childIds.has(f.studentId)));
        return;
      }

      // RLS already limits both tables to this parent's own children, so
      // neither query needs a filter of its own.
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, full_name")
        .order("full_name");
      setChildren((studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "" })));

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
    load();
  }, []);

  const childName = (id: string) => children.find((s) => s.id === id)?.name ?? "Your child";

  const billed = fees.reduce((sum, f) => sum + f.amountDue, 0);
  const paid = fees.reduce((sum, f) => sum + f.amountPaid, 0);
  const outstanding = billed - paid;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Fees"
        title="Payments"
        meta={outstanding > 0 ? [`${money(outstanding)} outstanding`] : ["All paid up"]}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={money(billed)} label="Billed" sub={`${fees.length} charges`} />
        <StatTile value={money(paid)} label="Paid" sub="thank you" />
        <StatTile value={money(outstanding)} label="Outstanding" sub="still owed" />
      </div>

      <SectionCard title="Your charges" note={`${fees.length} total`}>
        {fees.length === 0 ? (
          <EmptyNote>Nothing has been billed yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {fees.map((f) => {
              const status = feeStatus(f);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{f.description}</p>
                    <p className="text-[11px] text-ink-muted truncate">
                      {childName(f.studentId)} · due {f.dueDate}
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
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="text-[11px] text-ink-muted px-1">
        Payments are recorded by the school office. If something here looks wrong, send a message
        and they&apos;ll sort it out.
      </p>
    </div>
  );
}
