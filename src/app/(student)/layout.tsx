"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";
import { useStudentTheme } from "@/hooks/useStudentTheme";
import {
  IconHome,
  IconBook,
  IconPen,
  IconPalette,
  IconCalendar,
} from "@/components/icons";

// The tabs were emoji — 🏠 📖 📝 🎨 ✅ — which rendered as a different picture
// on every phone, went grey when inactive because there was no other way to
// dim them, and sat right next to the teacher's crisp line icons.
const TABS = [
  { href: "/student", label: "Home", Icon: IconHome },
  { href: "/student/quran", label: "Quran", Icon: IconBook },
  { href: "/student/assignments", label: "Work", Icon: IconPen },
  { href: "/student/tajweed", label: "Tajweed", Icon: IconPalette },
  { href: "/student/attendance", label: "Register", Icon: IconCalendar },
];

function StudentTabBar() {
  const pathname = usePathname();
  const theme = useStudentTheme();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/90 backdrop-blur-xl border-t border-surface-border safe-area-bottom">
      <div className="max-w-3xl mx-auto flex px-2 py-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-transform active:scale-90"
            >
              <span
                className={`w-9 h-7 rounded-full flex items-center justify-center transition-colors ${
                  active ? `${theme.accentRing} ${theme.accent}` : "text-ink-muted"
                }`}
              >
                <Icon size={18} />
              </span>
              <span
                className={`text-[10px] font-bold leading-none transition-colors ${
                  active ? theme.accent : "text-ink-muted"
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
