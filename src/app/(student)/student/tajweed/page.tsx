"use client";

import { getAllTajweedRules } from "@/lib/tajweed-rules";

export default function TajweedReferencePage() {
  const rules = getAllTajweedRules();

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Reference</p>
          <h1 className="page-title text-white text-3xl mt-1.5">Tajweed</h1>
          <p className="text-[13px] text-white/55 mt-2.5">
            {rules.length} rules
            <span className="text-white/25 mx-2">·</span>
            the colours in your Mushaf and what each one means
          </p>
        </div>
      </header>

      <section className="card-quiet p-5">
        <p className="text-[14px] text-ink-body leading-relaxed">
          Tajweed is the art of reciting the Qur&apos;an with the pronunciation it
          was revealed with. Every coloured letter in your Mushaf is one of these
          rules — tap or hover it while you read to see which.
        </p>
      </section>

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <article
            key={rule.id}
            className="card-quiet p-5 animate-rise"
            style={{ animationDelay: `${60 + i * 55}ms` }}
          >
            <div className="flex items-start gap-3">
              {/* rule.color is a Tailwind text-* class, not a hex value — it
                  was being handed to style={{backgroundColor}}, which is not
                  valid CSS, so every dot rendered hollow. bg-current picks the
                  colour up from the class instead. */}
              <span
                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1.5 bg-current ${rule.color}`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="page-title text-[17px]">{rule.name}</h2>
                  <p
                    className="font-arabic text-[17px] text-ink-muted flex-shrink-0"
                    dir="rtl"
                    lang="ar"
                  >
                    {rule.arabicName}
                  </p>
                </div>
                <p className="text-[12px] text-ink-muted mt-0.5">{rule.description}</p>
              </div>
            </div>

            <div className="gold-rule my-4" />

            <p className="text-[13px] text-ink-body leading-relaxed">{rule.details}</p>

            <div className="mt-4">
              <p className="eyebrow mb-2">Example letters</p>
              <div className="flex flex-wrap gap-2">
                {rule.examples.map((example) => (
                  <span
                    key={example}
                    className={`px-3 py-1.5 rounded-full text-[15px] font-bold font-arabic ${rule.bgColor}`}
                    dir="rtl"
                    lang="ar"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="card-quiet px-6 py-7 text-center">
        <p className="eyebrow">How to practise</p>
        <p className="font-serif text-[15px] text-ink-body italic mt-3 max-w-md mx-auto leading-relaxed">
          Take one rule at a time. Read a single ayah looking only for that
          colour, then move on. Recitation becomes natural far faster this way
          than trying to hold every rule at once.
        </p>
      </section>
    </div>
  );
}
