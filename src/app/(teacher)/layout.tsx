import { SidebarNav } from "@/components/SidebarNav";
import { ChatWidget } from "@/components/ChatWidget";

const NAV = [
  {
    href: "/teacher",
    label: "Classes",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></svg>,
  },
  {
    href: "/teacher/attendance",
    label: "Attendance",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    href: "/teacher/grades",
    label: "Grades",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>,
  },
  {
    href: "/teacher/lessons",
    label: "Lessons",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  },
  {
    href: "/teacher/quran-assignments",
    label: "Quranic Assignments",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><text x="7" y="13" textAnchor="middle" font-size="8" font-weight="bold">📖</text></svg>,
  },
  {
    href: "/teacher/curriculum",
    label: "Curriculum",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><line x1="12" y1="7" x2="17" y2="7"/><line x1="12" y1="12" x2="17" y2="12"/></svg>,
  },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-bg">
      <SidebarNav items={NAV} role="Teacher" userName="Ms. Teacher" />
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-20 md:pb-6 overflow-auto">{children}</main>
      <ChatWidget role="teacher" />
    </div>
  );
}
