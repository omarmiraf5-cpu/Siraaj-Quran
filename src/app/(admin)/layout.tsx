"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { PageFade } from "@/components/motion-ui";
import {
  IconBook,
  IconBookOpen,
  IconCalendar,
  IconCalendarBlank,
  IconCard,
  IconClock,
  IconGrid,
  IconMegaphone,
  IconNote,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV = [
  {
    href: "/admin",
    labelKey: "nav.dashboard",
    icon: <IconGrid />,
  },
  {
    href: "/admin/students",
    labelKey: "nav.students",
    icon: <IconUsers />,
  },
  {
    href: "/admin/teachers",
    labelKey: "nav.teachers",
    icon: <IconBook />,
  },
  {
    href: "/admin/student-attendance",
    labelKey: "nav.studentAttendance",
    // A register: a calendar page with a tick.
    icon: <IconCalendar />,
  },
  {
    href: "/admin/staff-attendance",
    labelKey: "nav.staffAttendance",
    icon: <IconClock />,
  },
  {
    href: "/admin/parents",
    labelKey: "nav.parents",
    icon: <IconUsers />,
  },
  {
    href: "/admin/halaqas",
    labelKey: "nav.halaqas",
    icon: <IconBookOpen />,
  },
  {
    href: "/admin/class-work",
    labelKey: "nav.classWork",
    // Islamic Studies and Arabic: a worksheet with lines of writing.
    icon: <IconNote />,
  },
  {
    href: "/admin/payments",
    labelKey: "nav.payments",
    icon: <IconCard />,
  },
  {
    href: "/admin/announcements",
    labelKey: "nav.announcements",
    icon: <IconMegaphone />,
  },
  {
    href: "/admin/calendar",
    labelKey: "nav.calendar",
    icon: <IconCalendarBlank />,
  },
  {
    href: "/account",
    labelKey: "nav.account",
    icon: <IconUser />,
  },
];

// For an admin who also teaches a halaqa: their teacher's pages.
const MY_HALAQA = {
  href: "/teacher",
  labelKey: "nav.myHalaqa",
  // An open book, as the teacher's Qa'idah has.
  icon: <IconBookOpen />,
};

// For an admin who is also a parent of a child here: their children, as a parent.
const PARENT_MODE = {
  href: "/parent",
  labelKey: "nav.parentMode",
  icon: <IconUsers />,
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
