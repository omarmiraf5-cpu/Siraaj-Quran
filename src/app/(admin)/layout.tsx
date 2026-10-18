"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV = [
  {
    href: "/admin",
    labelKey: "nav.dashboard",
    art: "keypad" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/admin/students",
    labelKey: "nav.students",
    art: "person" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/admin/teachers",
    labelKey: "nav.teachers",
    art: "board" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>,
  },
  {
    href: "/admin/student-attendance",
    labelKey: "nav.studentAttendance",
    art: "calendarCheck" as const,
    // A register: a calendar page with a tick.
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>,
  },
  {
    href: "/admin/staff-attendance",
    labelKey: "nav.staffAttendance",
    art: "clock" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  },
  {
    href: "/admin/parents",
    labelKey: "nav.parents",
    art: "people" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/admin/halaqas",
    labelKey: "nav.halaqas",
    art: "mosque" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8.5 4.4 4 4.4v13.2c4.5 0 6.5.6 8 2.1 1.5-1.5 3.5-2.1 8-2.1V4.4c-4.5 0-6.5.6-8 2.1Z"/><path d="M12 6.5v13.2"/></svg>,
  },
  {
    href: "/admin/class-work",
    labelKey: "nav.classWork",
    art: "document" as const,
    // Islamic Studies and Arabic: a worksheet with lines of writing.
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h5"/></svg>,
  },
  {
    href: "/admin/payments",
    labelKey: "nav.payments",
    art: "cash" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  },
  {
    href: "/admin/announcements",
    labelKey: "nav.announcements",
    art: "megaphone" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  },
  {
    href: "/admin/calendar",
    labelKey: "nav.calendar",
    art: "calendar" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  },
  {
    href: "/account",
    labelKey: "nav.account",
    art: "lock" as const,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  },
];

// For an admin who also teaches a halaqa: their teacher's pages.
const MY_HALAQA = {
  href: "/teacher",
  labelKey: "nav.myHalaqa",
  art: "board" as const,
  // An open book, as the teacher's Qa'idah has.
  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8.5 4.4 4 4.4v13.2c4.5 0 6.5.6 8 2.1 1.5-1.5 3.5-2.1 8-2.1V4.4c-4.5 0-6.5.6-8 2.1Z"/><path d="M12 6.5v13.2"/></svg>,
};

// For an admin who is also a parent of a child here: their children, as a parent.
const PARENT_MODE = {
  href: "/parent",
  labelKey: "nav.parentMode",
  art: "people" as const,
  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M14.5 20a4.5 4.5 0 0 1 7 0"/></svg>,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { teaches } = useStaffRoles();
  const { blocked } = useSignInGuard();
  // Straight after the dashboard: teaching is part of their every day.
  const { hasChildren } = useMyChildren();
  const base = teaches ? [NAV[0], MY_HALAQA, ...NAV.slice(1)] : NAV;
  const items = hasChildren ? [...base.slice(0, -1), PARENT_MODE, base[base.length - 1]] : base;
  return (
    <div className="flex min-h-screen bg-surface-bg">
      <SidebarNav items={items} roleKey="role.admin" />
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 overflow-auto">{blocked ? null : children}</main>
    </div>
  );
}
