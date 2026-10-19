"use client";

import { qaidahBook } from "@/data/qaidah";
import { PORTION_LABELS, formatDay } from "@/data/demo";
import { pagesNewestFirst, pagesText, type QaidahPageAssignment } from "@/lib/qaidahPages";
import { SectionCard } from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";

/** The Qa'idah pages a teacher has set for a child, still to do first. */
export function MyQaidahPages({ rows }: { rows: QaidahPageAssignment[] }) {
  const { tr, language } = useLanguage();
  if (rows.length === 0) return null;
  const words = { one: tr("Page {page}"), many: tr("Pages {from}–{to}") };
  const ordered = [...pagesNewestFirst(rows)].sort((a, b) => Number(a.status === "passed") - Number(b.status === "passed")).slice(0, 8);
  return (
    <SectionCard title={tr("Pages set for you")}>
      <ul className="divide-y divide-surface-border -my-1">
        {ordered.map((r) => (
          <li key={r.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">
                {pagesText(r, words)} <span className="font-normal text-ink-muted">· {qaidahBook(r.book).shortName}</span>
              </p>
              <p className="text-[12px] text-ink-muted mt-0.5">
                {PORTION_LABELS[r.portion]}
                {r.due_date ? ` · ${tr("due {day}", { day: formatDay(r.due_date, language) })}` : ""}
              </p>
              {r.note && <p className="text-[12.5px] text-ink-muted mt-1 italic [overflow-wrap:anywhere]">{r.note}</p>}
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                r.status === "passed"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                  : r.status === "repeat"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              }`}
            >
              {r.status === "assigned" ? tr("To do") : r.status === "passed" ? tr("Passed") : tr("Repeat")}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
