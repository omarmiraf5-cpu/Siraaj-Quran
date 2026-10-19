"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * On a new school's office home until its teachers, halaqas and students are
 * in: three steps, each a tick once done and a link to where it's done.
 * Gone for good once all three have something in them.
 */
export function GetStartedCard({ teachers, halaqas, students }: { teachers: number; halaqas: number; students: number }) {
  const { tr } = useLanguage();
  const steps = [
    { done: teachers > 0, title: tr("Add your teachers"), note: tr("Each gets a login and a welcome email."), href: "/admin/teachers", go: tr("Add teachers") },
    { done: halaqas > 0, title: tr("Create your halaqas"), note: tr("Put each teacher on their halaqa."), href: "/admin/halaqas", go: tr("Add halaqas") },
    {
      done: students > 0,
      title: tr("Bring in your students"),
      note: tr("Upload a spreadsheet with a parent email on every row. Each student gets a PIN, and each parent a welcome email with it."),
      href: "/admin/students",
      go: tr("Import students"),
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <section className="card-quiet p-5" data-section="get-started">
      <p className="font-semibold text-[14px] text-ink">{tr("Get your school started")}</p>
      <p className="text-[12.5px] text-ink-muted mt-0.5">{tr("Three steps, in this order.")}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.href} className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <span
              className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                s.done ? "bg-emerald-600 text-white" : i === next ? "bg-brand-navy text-white" : "bg-surface-bg text-ink-muted"
              }`}
            >
              {s.done ? <Check size={14} aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 basis-[calc(100%-2.25rem)] sm:basis-0">
              <p className={`text-[13.5px] font-medium ${s.done ? "text-ink-muted line-through" : "text-ink"}`}>{s.title}</p>
              {!s.done && <p className="text-[12px] text-ink-muted mt-0.5">{s.note}</p>}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className={`flex-shrink-0 ms-9 sm:ms-0 text-[12.5px] font-semibold px-3 py-1.5 rounded-xl ${
                  i === next ? "bg-brand-navy text-white" : "border border-slate-300 text-ink"
                }`}
              >
                {s.go}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
