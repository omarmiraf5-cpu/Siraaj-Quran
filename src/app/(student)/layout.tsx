"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";
import { ILLUM_CLASS } from "@/components/student-ui";
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
const TABS = [
  { href: "/student", label: "Home", Icon: IconHome, colour: "saffron" },
  { href: "/student/quran", label: "Quran", Icon: IconBook, colour: "lapis" },
  { href: "/student/assignments", label: "Work", Icon: IconPen, colour: "verdigris" },
  { href: "/student/tajweed", label: "Tajweed", Icon: IconPalette, colour: "aubergine" },
  { href: "/student/attendance", label: "Register", Icon: IconCalendar, colour: "turquoise" },
] as const;

function StudentTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/90 backdrop-blur-xl border-t border-surface-border safe-area-bottom">
      <div className="max-w-3xl mx-auto flex px-2 py-1.5">
        {TABS.map(({ href, label, Icon, colour }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-transform active:scale-90"
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
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-bg pb-28">
      <div className="max-w-3xl mx-auto">{children}</div>
      <StudentTabBar />
      <ChatWidget role="student" />
    </div>
  );
}
