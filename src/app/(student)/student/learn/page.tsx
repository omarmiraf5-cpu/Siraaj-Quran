"use client";

import { QAIDAH_LESSONS } from "@/data/qaidah";
import { ARBAEEN } from "@/data/arbaeen";
import { getAllTajweedRules } from "@/lib/tajweed-rules";
import { GRAD_CLASS } from "@/components/student-ui";
import { IconArrow, IconBookOpen, IconPalette, IconStar } from "@/components/icons";

// The three things to study that are not the Mushaf itself. They were going to
// be three more tabs, which would have made seven along the bottom of a phone;
// one tab holding three is easier to hit and easier to grow.
const SHELF = [
  {
    href: "/student/qaidah",
    colour: "verdigris" as const,
    icon: <IconBookOpen size={22} />,
    title: "Qa'idah",
    arabic: "الْقَاعِدَةُ النُّورَانِيَّةُ",
    sub: "Learn to read Arabic, from the letters up.",
    count: `${QAIDAH_LESSONS.length} lessons`,
  },
  {
    href: "/student/tajweed",
    colour: "aubergine" as const,
    icon: <IconPalette size={22} />,
    title: "Tajweed",
    arabic: "التَّجْوِيدُ",
    sub: "The colours in your Mushaf and what each one means.",
    count: `${getAllTajweedRules().length} rules`,
  },
  {
    href: "/student/hadith",
    colour: "lapis" as const,
    icon: <IconStar size={22} />,
    title: "Forty Hadith",
    arabic: "الْأَرْبَعُونَ النَّوَوِيَّةُ",
    sub: "Imam an-Nawawi's collection, in Arabic and English.",
    count: `${ARBAEEN.length} hadith`,
  },
];

export default function StudentLearnPage() {
  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Your books</p>
          <h1 className="page-title text-white text-[30px] mt-1 leading-tight">Learn</h1>
          <p className="text-[13px] text-white/55 mt-2.5">
            Everything to study alongside the Mushaf.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {SHELF.map((item, i) => (
          <a
            key={item.href}
            href={item.href}
            className="card-quiet card-feature group flex items-center gap-4 p-4 animate-rise transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99]"
            style={{ animationDelay: `${60 + i * 70}ms` }}
          >
            <span
              className={`${GRAD_CLASS[item.colour]} w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-sm`}
            >
              {item.icon}
            </span>

            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="page-title text-[17px]">{item.title}</span>
                <span
                  className="font-arabic text-[15px] text-ink-muted flex-shrink-0 truncate"
                  dir="rtl"
                  lang="ar"
                >
                  {item.arabic}
                </span>
              </span>
              <span className="block text-[12px] text-ink-muted mt-0.5 leading-snug">
                {item.sub}
              </span>
              <span className="eyebrow mt-1.5 block">{item.count}</span>
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
