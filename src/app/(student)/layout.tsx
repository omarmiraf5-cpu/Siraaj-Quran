"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";
import { useStudentTheme } from "@/hooks/useStudentTheme";

const TABS = [
  { href: "/student", label: "Home", emoji: "🏠" },
  { href: "/student/quran", label: "Quran", emoji: "📖" },
  { href: "/student/assignments", label: "Work", emoji: "📝" },
  { href: "/student/tajweed", label: "Tajweed", emoji: "🎨" },
  { href: "/student/attendance", label: "Attendance", emoji: "✅" },
];

function StudentTabBar({ accent }: { accent: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-md border-t border-surface-border safe-area-bottom">
      <div className="max-w-3xl mx-auto flex px-2 py-1.5">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-all active:scale-90"
            >
              <span
                className={`text-2xl transition-transform ${
                  active ? "scale-110" : "opacity-45 grayscale"
                }`}
              >
                {tab.emoji}
              </span>
              <span
                className={`text-[10px] font-bold leading-none transition-colors ${
                  active ? accent : "text-ink-muted"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const theme = useStudentTheme();

  return (
    <div className={`min-h-screen ${theme.bg} pb-28`}>
      <div className="max-w-3xl mx-auto">{children}</div>
      <StudentTabBar accent={theme.accent} />
      <ChatWidget role="student" />
    </div>
  );
}
