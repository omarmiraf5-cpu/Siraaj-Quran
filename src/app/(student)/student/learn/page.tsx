"use client";

import { QAIDAH_BOOKS } from "@/data/qaidah";
import { ARBAEEN } from "@/data/arbaeen";
import { getAllTajweedRules } from "@/lib/tajweed-rules";
import { StudentPageHeader } from "@/components/student-ui";
import { IconArrow } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

// The three things to study that are not the Mushaf itself. They were going to
// be three more tabs, which would have made seven along the bottom of a phone;
// one tab holding three is easier to hit and easier to grow.
const SHELF = [
  {
    href: "/student/qaidah",
    gradient: "student-gradient-blue",
    icon: "📘",
    title: "Qa'idah",
    arabic: "الْقَاعِدَةُ",
    sub: "Learn to read Arabic from the letters up: Ahsanul Qawaid, the Noorani Qaida or the Baghdadi Qaida.",
    count: { text: "{count} book|{count} books", count: QAIDAH_BOOKS.length },
  },
  {
    href: "/student/tajweed",
    gradient: "student-gradient-indigo",
    icon: "🌈",
    title: "Tajweed",
    arabic: "التَّجْوِيدُ",
    sub: "The colours in your Mushaf and what each one means.",
    count: { text: "{count} rule|{count} rules", count: getAllTajweedRules().length },
  },
  {
    href: "/student/hadith",
    gradient: "student-gradient-cyan",
    icon: "📜",
    title: "Forty Hadith",
    arabic: "الْأَرْبَعُونَ النَّوَوِيَّةُ",
    sub: "Imam an-Nawawi's collection, in Arabic and English.",
    count: { text: "{count} hadith|{count} hadith", count: ARBAEEN.length },
  },
];

export default function StudentLearnPage() {
  const { tr, language } = useLanguage();
  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <StudentPageHeader
        emoji="🎨"
        eyebrow={tr("Your books")}
        title={tr("Learn")}
        subtitle={tr("Everything to study alongside the Mushaf.")}
      />

      <div className="space-y-3">
        {SHELF.map((item, i) => (
          <a
            key={item.href}
            href={item.href}
            className="bg-surface-card rounded-3xl border border-surface-border shadow-card group flex items-center gap-4 p-4 animate-rise transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99]"
            style={{ animationDelay: `${60 + i * 70}ms` }}
          >
            <span
              className={`${item.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-md`}
              aria-hidden
            >
              {item.icon}
            </span>

            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="page-title text-[17px]">{tr(item.title)}</span>
                {language !== "ar" && <span
                  className="font-arabic text-[15px] text-ink-muted flex-shrink-0 [overflow-wrap:anywhere]"
                  dir="rtl"
                  lang="ar"
                >
                  {item.arabic}
                </span>}
              </span>
              <span className="block text-[12px] text-ink-muted mt-0.5 leading-snug">
                {tr(item.sub)}
              </span>
              <span className="eyebrow mt-1.5 block">{tr(item.count.text, { count: item.count.count })}</span>
            </span>

            <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
              <IconArrow size={15} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
