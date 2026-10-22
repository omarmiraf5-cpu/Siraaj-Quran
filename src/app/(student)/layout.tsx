"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useRecordVisit } from "@/hooks/useRecordVisit";
import { useSignInGuard } from "@/hooks/useSignInGuard";

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
  { href: "/student", labelKey: "nav.home", emoji: "🏠", colour: "saffron" },
  { href: "/student/quran", labelKey: "nav.quran", emoji: "📖", colour: "lapis" },
  { href: "/student/assignments", labelKey: "nav.work", emoji: "📝", colour: "verdigris" },
  { href: "/student/learn", labelKey: "nav.learn", emoji: "🎨", colour: "aubergine" },
  { href: "/student/attendance", labelKey: "nav.register", emoji: "✅", colour: "turquoise" },
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
        {TABS.map(({ href, labelKey, emoji }) => {
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
              className="flex-1 min-w-0 flex flex-col items-center justify-start gap-1 py-1.5 rounded-2xl transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90"
            >
              <span
                className={`h-8 flex items-center justify-center transition-all ${active ? "scale-110" : ""}`}
              >
                <span className="text-xl" aria-hidden>{emoji}</span>
              </span>
              <span
                className={`text-[11px] max-[359px]:text-[9px] max-[359px]:tracking-tight font-bold leading-tight text-center transition-colors ${
                  active ? "text-subject-blue" : "text-ink-muted"
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
  // A student's pages are for a student's login only, and a login that has
  // run out goes back to the PIN pad rather than to sample pages.
  const { blocked } = useSignInGuard();
  if (blocked) return <div className="min-h-screen bg-surface-bg" />;
  return (
    <div className="min-h-screen bg-[#f2f6fb] dark:bg-[#0d1117] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto">{children}</div>
      <StudentTabBar />
    </div>
  );
}
