import { SidebarNav } from "@/components/SidebarNav";
import { ChatWidget } from "@/components/ChatWidget";

const NAV = [
  {
    href: "/teacher",
    label: "Dashboard",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/teacher/mushaf",
    label: "Mushaf",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>,
  },
  {
    href: "/teacher/attendance",
    label: "Attendance",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>,
  },
  {
    href: "/teacher/quran-assignments",
    label: "Assignments",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    href: "/teacher/qaidah",
    label: "Qa'idah",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8.5 4.4 4 4.4v13.2c4.5 0 6.5.6 8 2.1 1.5-1.5 3.5-2.1 8-2.1V4.4c-4.5 0-6.5.6-8 2.1Z"/><path d="M12 6.5v13.2"/></svg>,
  },
  {
    href: "/teacher/hadith",
    label: "Forty Hadith",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8Z"/></svg>,
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
