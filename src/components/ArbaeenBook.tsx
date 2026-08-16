"use client";

import { useState } from "react";
import { ARBAEEN, ARBAEEN_THEMES, type Hadith } from "@/data/arbaeen";
import { ILLUM_CLASS, GRAD_CLASS, ILLUM, type IllumColour } from "@/components/student-ui";
import { IconArrow, IconStar } from "@/components/icons";

// Each theme keeps one colour across the whole collection, so the two hadith
// on brotherhood are visibly a pair. Assigned by position in the theme list
// rather than hashed, because the list is short enough to walk the palette
// evenly.
function themeColour(theme: string): IllumColour {
  const i = ARBAEEN_THEMES.indexOf(theme);
  return ILLUM[(i < 0 ? 0 : i) % ILLUM.length];
}

export function ArbaeenBook() {
  const [open, setOpen] = useState<number | null>(1);
  const [theme, setTheme] = useState<string | null>(null);

  const shown = theme ? ARBAEEN.filter((h) => h.theme === theme) : ARBAEEN;

  return (
    <div className="space-y-3">
      {/* Filter by theme. Forty-two is a lot to scroll when you want the one
          about intention. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <FilterChip active={theme === null} onClick={() => setTheme(null)}>
          All {ARBAEEN.length}
        </FilterChip>
        {ARBAEEN_THEMES.map((t) => (
          <FilterChip key={t} active={theme === t} onClick={() => setTheme(t)}>
            {t}
          </FilterChip>
        ))}
      </div>

      {shown.map((h, i) => (
        <HadithCard
          key={h.number}
          hadith={h}
          isOpen={open === h.number}
          onToggle={() => setOpen(open === h.number ? null : h.number)}
          delay={40 + i * 30}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all ${
        active
          ? "bg-brand-navy text-white shadow-sm"
          : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function HadithCard({
  hadith,
  isOpen,
  onToggle,
  delay,
}: {
  hadith: Hadith;
  isOpen: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const colour = themeColour(hadith.theme);

  return (
    <article
      className="card-quiet overflow-hidden animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-surface-bg-warm transition-colors"
      >
        <span
          className={`${GRAD_CLASS[colour]} w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 shadow-sm`}
        >
          {hadith.number}
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="page-title text-[16px] truncate">{hadith.theme}</span>
            {hadith.qudsi && (
              <span
                className={`${ILLUM_CLASS.saffron} inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0`}
              >
                <IconStar size={9} />
                Qudsi
              </span>
            )}
          </span>
          <span className="block text-[12px] text-ink-muted mt-0.5 truncate">
            {hadith.narrator} · {hadith.source}
          </span>
        </span>

        <span
          className={`text-ink-muted flex-shrink-0 transition-transform ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          <IconArrow size={15} />
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-5">
          <div className="gold-rule mb-4" />

          {/* Arabic first — it is the hadith; the English is a rendering of
              it. The isnad runs into the matn the way it does in print, so
              they sit in one block; the matn is darker and larger, because
              that is the part being memorised. */}
          <div dir="rtl" lang="ar" className="text-right">
            <p className="font-arabic text-[17px] md:text-[18px] text-ink-muted leading-[2.1]">
              {hadith.isnad}
            </p>
            <p className="font-arabic text-[21px] md:text-[23px] text-ink leading-[2.15] mt-1">
              {hadith.arabic}
            </p>
          </div>

          <div className="gold-rule my-4" />

          <p className="text-[12px] text-ink-muted leading-relaxed">{hadith.isnadEn}</p>
          <p className="font-serif text-[14px] text-ink-body leading-relaxed italic mt-1.5">
            {hadith.english}
          </p>

          <p className="text-[11px] text-ink-muted mt-3.5 pt-3 border-t border-surface-border">
            {hadith.source}
          </p>
        </div>
      )}
    </article>
  );
}

/** The note at the top of the Forty Hadith page. */
export function ArbaeenSummary() {
  const qudsi = ARBAEEN.filter((h) => h.qudsi).length;
  return (
    <section className="card-quiet card-feature p-5">
      <div className="flex items-start gap-3.5">
        <span className={`${ILLUM_CLASS.aubergine} w-10 h-10 rounded-2xl flex-shrink-0`}>
          <IconStar size={18} />
        </span>
        <div>
          <h2 className="page-title text-[16px]">Al-Arba&apos;un an-Nawawiyyah</h2>
          <p className="text-[13px] text-ink-body leading-relaxed mt-1">
            {ARBAEEN.length} hadith gathered by Imam an-Nawawi, {qudsi} of them
            qudsi. Between them they carry most of what a Muslim needs to
            practise the religion. Tap one to read it in Arabic and English.
          </p>
        </div>
      </div>
    </section>
  );
}
