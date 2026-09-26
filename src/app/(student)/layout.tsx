"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ILLUM_CLASS } from "@/components/student-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { useRecordVisit } from "@/hooks/useRecordVisit";
import {
  IconHome,
  IconBook,
  IconPen,
  IconPalette,
  IconCalendar,
} from "@/components/icons";

// The tabs were emoji — 🏠 📖 📝 🎨 ✅ — which rendered as a different picture
// on every phone, went grey when inactive because there was no other way to
// dim them, and sat right next to the teacher's crisp line icons. Each now
// carries its own illumination colour, so the bar is colourful and a child
// navigates by colour as much as by label.
// "Learn" is a hub rather than a page: the Qa'idah, Tajweed and the Forty
// Hadith behind one tab. Giving each its own would have made seven tabs along
// the bottom of a phone, and the row is already at the width where a thumb
// starts missing.
const TABS = [
  { href: "/student", labelKey: "nav.home", Icon: IconHome, colour: "saffron" },
  { href: "/student/quran", labelKey: "nav.quran", Icon: IconBook, colour: "lapis" },
  { href: "/student/assignments", labelKey: "nav.work", Icon: IconPen, colour: "verdigris" },
  { href: "/student/learn", labelKey: "nav.learn", Icon: IconPalette, colour: "aubergine" },
  { href: "/student/attendance", labelKey: "nav.register", Icon: IconCalendar, colour: "turquoise" },
] as const;

// The Learn tab stays lit while you are inside any of the books it holds,
// and the Work tab across both kinds of work: the Qur'an, and Islamic
// Studies and Arabic.
const LEARN_PATHS = ["/student/learn", "/student/qaidah", "/student/tajweed", "/student/hadith"];
const WORK_PATHS = ["/student/assignments", "/student/class-work"];

function StudentTabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 start-0 end-0 z-50 bg-surface-card/90 backdrop-blur-xl border-t border-surface-border safe-area-bottom">
      <div className="max-w-5xl mx-auto flex px-2 py-1.5">
        {TABS.map(({ href, labelKey, Icon, colour }) => {
          const active =
            href === "/student/learn"
              ? LEARN_PATHS.some((p) => pathname.startsWith(p))
              : href === "/student/assignments"
                ? WORK_PATHS.some((p) => pathname.startsWith(p))
                : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90"
            >
              <span
                className={`w-10 h-8 rounded-full flex items-center justify-center transition-all ${
                  active
                    ? `${ILLUM_CLASS[colour]} scale-105`
                    : "text-ink-muted border border-transparent"
                }`}
              >
                <Icon size={18} />
              </span>
              <span
                className={`text-[10px] font-bold leading-none transition-colors ${
                  active ? "text-ink" : "text-ink-muted"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  useRecordVisit();
  return (
    <div className="min-h-screen bg-surface-bg pb-28">
      <div className="max-w-5xl mx-auto">{children}</div>
      <StudentTabBar />
    </div>
  );
}
