"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { PageFade } from "@/components/motion-ui";
import type { ArtName } from "@/components/gem-icons";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV: { href: string; labelKey: string; art: ArtName }[] = [
  { href: "/admin", labelKey: "nav.dashboard", art: "keypad" },
  { href: "/admin/students", labelKey: "nav.students", art: "person" },
  { href: "/admin/teachers", labelKey: "nav.teachers", art: "book" },
  { href: "/admin/student-attendance", labelKey: "nav.studentAttendance", art: "calendarCheck" },
  { href: "/admin/staff-attendance", labelKey: "nav.staffAttendance", art: "clock" },
  { href: "/admin/parents", labelKey: "nav.parents", art: "people" },
  { href: "/admin/halaqas", labelKey: "nav.halaqas", art: "mosque" },
  { href: "/admin/class-work", labelKey: "nav.classWork", art: "globe" },
  { href: "/admin/payments", labelKey: "nav.payments", art: "cash" },
  { href: "/admin/announcements", labelKey: "nav.announcements", art: "megaphone" },
  { href: "/admin/calendar", labelKey: "nav.calendar", art: "calendar" },
  { href: "/account", labelKey: "nav.account", art: "person" },
];

// For an admin who also teaches a halaqa: their teacher's pages.
const MY_HALAQA = {
  href: "/teacher",
  labelKey: "nav.myHalaqa",
  art: "mosque" as ArtName,
};

// For an admin who is also a parent of a child here: their children, as a parent.
const PARENT_MODE = {
  href: "/parent",
  labelKey: "nav.parentMode",
  art: "people" as ArtName,
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
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-24 md:pb-8 overflow-auto">{blocked ? null : <PageFade>{children}</PageFade>}</main>
    </div>
  );
}
