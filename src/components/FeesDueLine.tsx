"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/data/demo";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { myChildIds } from "@/hooks/useMyChildren";
import { todayIso } from "@/lib/finance";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * One quiet line on a parent's home when a fee for their children is past
 * its due date, so they needn't open Payments to find out. Nothing at all
 * when nothing is overdue (or when signed out, as in the sample portal).
 */
export function FeesDueLine() {
  const { tr } = useLanguage();
  const [due, setDue] = useState<{ total: number; count: number } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        if (!(await sessionUser(supabase))) return;
        const ids = await myChildIds(supabase);
        if (ids.length === 0) return;
        const { data } = await supabase.from("fees").select("amount_due, amount_paid, due_date").in("student_id", ids).lt("due_date", todayIso());
        const owing = (data ?? []).filter((f) => Number(f.amount_due) > Number(f.amount_paid));
        if (live && owing.length > 0) {
          setDue({ total: owing.reduce((n, f) => n + Number(f.amount_due) - Number(f.amount_paid), 0), count: owing.length });
        }
      } catch {
        /* A missing fees line is no reason to break the home page. */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!due) return null;
  return (
    <Link
      href="/parent/payments"
      className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 px-4 py-3 text-[13px] text-amber-900 dark:text-amber-200"
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {tr("{count} fee is past its due date: {amount} still to pay.|{count} fees are past their due date: {amount} still to pay.", { count: due.count, amount: money(due.total) })}
      </span>
      <span className="flex-shrink-0 font-semibold">{tr("View payments")}</span>
    </Link>
  );
}
