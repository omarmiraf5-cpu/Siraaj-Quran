"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useRecordVisit } from "@/hooks/useRecordVisit";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import {
  IconHome,
  IconBook,
  IconPen,
  IconPalette,
  IconCalendar,
  IconBadge,
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
    <div className="fixed bottom-3 inset-x-3 z-50 safe-area-bottom pointer-events-none">
    <nav className="dock pointer-events-auto mx-auto max-w-lg flex rounded-[28px] p-1.5">
        {TABS.map(({ href, labelKey, Icon }) => {
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
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-12 py-1 rounded-[20px] transition-all active:scale-95 ${active ? "dock-pill" : ""}`}
            >
              <IconBadge size="sm">
                <Icon size={15} />
              </IconBadge>
              <span
                className={`text-[11px] font-bold leading-none transition-colors ${
                  active ? "text-[#1c1408]" : "text-ink-muted"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
    </nav>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  useRecordVisit();
  // A student's pages are for a student's login only, and a login that has
  // run out goes back to the PIN pad rather than to sample pages.
  const { blocked } = useSignInGuard();
  if (blocked) return <div className="min-h-screen bg-surface-bg" />;
  return (
    <div className="min-h-screen bg-surface-bg pb-28">
      <div className="page-enter max-w-5xl mx-auto">{children}</div>
      <StudentTabBar />
    </div>
  );
}
