"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { PageFade } from "@/components/motion-ui";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Megaphone,
  Presentation,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV = [
  { href: "/admin", labelKey: "nav.dashboard", mark: LayoutDashboard },
  { href: "/admin/students", labelKey: "nav.students", mark: GraduationCap },
  { href: "/admin/teachers", labelKey: "nav.teachers", mark: Presentation },
  { href: "/admin/student-attendance", labelKey: "nav.studentAttendance", mark: CalendarCheck },
  { href: "/admin/staff-attendance", labelKey: "nav.staffAttendance", mark: ClipboardCheck },
  { href: "/admin/parents", labelKey: "nav.parents", mark: Users },
  { href: "/admin/halaqas", labelKey: "nav.halaqas", mark: BookOpen },
  { href: "/admin/class-work", labelKey: "nav.classWork", mark: Languages },
  { href: "/admin/payments", labelKey: "nav.payments", mark: Wallet },
  { href: "/admin/announcements", labelKey: "nav.announcements", mark: Megaphone },
  { href: "/admin/calendar", labelKey: "nav.calendar", mark: CalendarDays },
  { href: "/account", labelKey: "nav.account", mark: UserRound },
];

// For an admin who also teaches a halaqa: their teacher's pages.
const MY_HALAQA = {
  href: "/teacher",
  labelKey: "nav.myHalaqa",
  mark: BookOpen,
};

// For an admin who is also a parent of a child here: their children, as a parent.
const PARENT_MODE = {
  href: "/parent",
  labelKey: "nav.parentMode",
  mark: Users,
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
