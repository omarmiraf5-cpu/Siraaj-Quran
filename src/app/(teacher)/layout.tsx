"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { PageFade } from "@/components/motion-ui";
import {
  IconBook,
  IconBookOpen,
  IconBuildings,
  IconCalendar,
  IconChat,
  IconClipboard,
  IconClock,
  IconGrid,
  IconMedal,
  IconNote,
  IconPath,
  IconStar,
  IconUser,
  IconUsers,
} from "@/components/icons";
import type { ArtName } from "@/components/gem-icons";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useRequirePasswordChange } from "@/hooks/useRequirePasswordChange";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { useMyChildren } from "@/hooks/useMyChildren";

// Ordered so the four things a teacher actually opens every day come
// first — SidebarNav keeps only that many as mobile tabs and folds
// everything after into a "More" sheet, so this order decides which four.
// Signing in (their own attendance) sits straight under the class's.
const NAV: { href: string; labelKey: string; icon: React.ReactNode; art: ArtName }[] = [
  {
    href: "/teacher",
    labelKey: "nav.dashboard",
    icon: <IconGrid />,
    art: "keypad",
  },
  {
    href: "/teacher/attendance",
    labelKey: "nav.attendance",
    icon: <IconCalendar />,
    art: "calendarCheck",
  },
  {
    href: "/teacher/my-attendance",
    labelKey: "nav.signIn",
    // A clock face: signing in and out, and being on time.
    icon: <IconClock />,
    art: "clock",
  },
  {
    href: "/teacher/quran-assignments",
    labelKey: "nav.assignments",
    icon: <IconClipboard />,
    art: "pen",
  },
  // The Qa'idah straight under the Qur'an assignments: setting a child's
  // Qa'idah lesson is the same job for the children not reading yet.
  {
    href: "/teacher/qaidah",
    labelKey: "nav.qaidah",
    icon: <IconBookOpen />,
    art: "book",
  },
  {
    href: "/teacher/class-work",
    labelKey: "nav.classWork",
    // Islamic Studies and Arabic: a worksheet with lines of writing.
    icon: <IconNote />,
    art: "globe",
  },
  {
    href: "/teacher/messages",
    labelKey: "nav.messages",
    icon: <IconChat />,
    art: "mail",
  },
  {
    href: "/teacher/yearly-plan",
    labelKey: "nav.yearlyPlan",
    // A milestone track: a rule with three stops. Geometric by
    // construction — the module carries no figurative marks anywhere.
    icon: <IconPath />,
    art: "calendar",
  },
  {
    href: "/teacher/mushaf",
    labelKey: "nav.mushaf",
    icon: <IconBook />,
    art: "book",
  },
  {
    href: "/teacher/hadith",
    labelKey: "nav.hadith",
    icon: <IconStar />,
    art: "book",
  },
  {
    href: "/teacher/awards",
    labelKey: "nav.awards",
    icon: <IconMedal />,
    art: "check",
  },
  {
    href: "/account",
    labelKey: "nav.account",
    icon: <IconUser />,
    art: "person",
  },
];

// For the school's admin, teaching a halaqa here: back to running the school.
const SCHOOL_OFFICE = {
  href: "/admin",
  labelKey: "nav.office",
  // A building with a door.
  icon: <IconBuildings />,
  art: "mosque" as ArtName,
};

// For a teacher who is also a parent of a child here: their children, as a parent.
const PARENT_MODE = {
  href: "/parent",
  labelKey: "nav.parentMode",
  icon: <IconUsers />,
  art: "people" as ArtName,
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  useRequirePasswordChange();
  const { admin } = useStaffRoles();
  const { blocked } = useSignInGuard();
  // Just before their own account, at the end.
  const { hasChildren } = useMyChildren();
  const extras = [...(admin ? [SCHOOL_OFFICE] : []), ...(hasChildren ? [PARENT_MODE] : [])];
  const items = [...NAV.slice(0, -1), ...extras, NAV[NAV.length - 1]];

  return (
    <div className="flex min-h-screen bg-surface-bg">
      <SidebarNav items={items} roleKey={admin ? "role.admin" : "role.teacher"} />
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-24 md:pb-8 overflow-auto">{blocked ? null : <PageFade>{children}</PageFade>}</main>
    </div>
  );
}
