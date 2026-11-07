"use client";

import { useState } from "react";
import { balancesByStudent } from "@/lib/balances";
import { monthLabel, monthOf, shiftMonth, todayIso } from "@/lib/finance";
import { money, type DemoFee } from "@/data/demo";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Every student's month on one line, like the school's payments sheet:
 * what they still owed before the month, this month's fee, what they paid,
 * and what remains — with the totals underneath.
 */
export function PaymentsSheet({
  fees,
  studentName,
  onPick,
}: {
  fees: DemoFee[];
  studentName: (id: string) => string;
  onPick?: (name: string) => void;
}) {
  const { tr } = useLanguage();
  const [month, setMonth] = useState(monthOf(todayIso()));
  const rows = balancesByStudent(fees, month)
    .map((b) => ({ id: b.studentId, name: studentName(b.studentId), old: b.old, fee: b.monthBilled, paid: b.monthPaid, left: b.outstanding }))
    .filter((r) => r.old || r.fee || r.paid || r.left)
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.reduce(
    (t, r) => ({ old: t.old + r.old, fee: t.fee + r.fee, paid: t.paid + r.paid, left: t.left + r.left }),
    { old: 0, fee: 0, paid: 0, left: 0 }
  );

  const exportCsv = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Student's name", "Outstanding balance", "Current month fee", "Amount paid", "Remaining balance"],
      ...rows.map((r) => [r.name, r.old.toFixed(2), r.fee.toFixed(2), r.paid.toFixed(2), r.left.toFixed(2)]),
      ["Total", total.old.toFixed(2), total.fee.toFixed(2), total.paid.toFixed(2), total.left.toFixed(2)],
    ];
    const blob = new Blob(["﻿" + lines.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payments-${month.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const head = "px-3 py-2.5 text-start text-[12.5px] font-bold text-[#4a1d3a] bg-[#e8bfd6] border border-[#2b2b2b]/70 whitespace-nowrap";
  const cellCls = "px-3 py-2 text-[13px] tabular-nums text-end border border-[#2b2b2b]/40";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={tr("Previous month")} onClick={() => setMonth(shiftMonth(month, -1))} className="w-9 h-9 rounded-full border border-surface-border bg-surface-card font-bold">‹</button>
          <span className="min-w-[8.5rem] text-center text-sm font-bold">{monthLabel(month)}</span>
          <button type="button" aria-label={tr("Next month")} onClick={() => setMonth(shiftMonth(month, 1))} className="w-9 h-9 rounded-full border border-surface-border bg-surface-card font-bold">›</button>
        </div>
        <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-[13px] font-semibold disabled:opacity-40">
          {tr("Export CSV")}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-3">{tr("Nothing billed or owed in this month.")}</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse min-w-[34rem]">
            <thead>
              <tr>
                <th className={head}>{tr("Student's name")}</th>
                <th className={`${head} text-end`}>{tr("Outstanding balance")}</th>
                <th className={`${head} text-end`}>{tr("Current month fee")}</th>
                <th className={`${head} text-end`}>{tr("Amount paid")}</th>
                <th className={`${head} text-end`}>{tr("Remaining balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={onPick ? "cursor-pointer hover:bg-surface-bg-warm" : ""} onClick={() => onPick?.(r.name)}>
                  <td className="px-3 py-2 text-[13px] font-semibold border border-[#2b2b2b]/40">{r.name}</td>
                  <td className={cellCls}>{money(r.old)}</td>
                  <td className={cellCls}>{money(r.fee)}</td>
                  <td className={cellCls}>{money(r.paid)}</td>
                  <td className={`${cellCls} font-bold ${r.left > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{money(r.left)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-bg-warm">
                <td className="px-3 py-2.5 text-[13px] font-bold border border-[#2b2b2b]/70">{tr("Total")}</td>
                <td className={`${cellCls} font-bold border-[#2b2b2b]/70`}>{money(total.old)}</td>
                <td className={`${cellCls} font-bold border-[#2b2b2b]/70`}>{money(total.fee)}</td>
                <td className={`${cellCls} font-bold border-[#2b2b2b]/70`}>{money(total.paid)}</td>
                <td className={`${cellCls} font-bold border-[#2b2b2b]/70`}>{money(total.left)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {onPick && rows.length > 0 && <p className="text-[11.5px] text-ink-muted mt-2">{tr("Tap a student to see their charges below.")}</p>}
    </div>
  );
}
