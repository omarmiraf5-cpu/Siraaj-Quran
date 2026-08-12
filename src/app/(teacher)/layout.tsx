import { SidebarNav } from "@/components/SidebarNav";
import { ChatWidget } from "@/components/ChatWidget";

const NAV = [
  {
    href: "/teacher",
    label: "Dashboard",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/teacher/quran-assignments",
    label: "Quranic Assignments",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>,
  },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-bg">
      <SidebarNav items={NAV} role="Teacher" userName="Teacher" />
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-20 md:pb-6 overflow-auto">{children}</main>
      <ChatWidget role="teacher" />
    </div>
  );
}
