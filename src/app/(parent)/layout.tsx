"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { PageFade } from "@/components/motion-ui";
import {
  IconBook,
  IconBookOpen,
  IconBuildings,
  IconCalendar,
  IconCard,
  IconChat,
  IconChart,
  IconGrid,
  IconNote,
  IconPath,
  IconUser,
} from "@/components/icons";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useRequirePasswordChange } from "@/hooks/useRequirePasswordChange";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV = [
  {
    href: "/parent",
    labelKey: "nav.dashboard",
    icon: <IconGrid />,
  },
  {
    href: "/parent/mushaf",
    labelKey: "nav.mushaf",
    icon: <IconBook />,
  },
  {
    href: "/parent/quran-progress",
    labelKey: "nav.progress",
    icon: <IconChart />,
  },
  {
    href: "/parent/class-work",
    labelKey: "nav.classWork",
    // Islamic Studies and Arabic: a worksheet with lines of writing.
    icon: <IconNote />,
  },
  {
    href: "/parent/yearly-plan",
    labelKey: "nav.yearlyPlan",
    // A milestone track: a rule with three stops. Geometric by
    // construction — the module carries no figurative marks anywhere.
    icon: <IconPath />,
  },
  {
    href: "/parent/attendance",
    labelKey: "nav.attendance",
    icon: <IconCalendar />,
  },
  {
    href: "/parent/messages",
    labelKey: "nav.messages",
    icon: <IconChat />,
  },
  {
    href: "/parent/payments",
    labelKey: "nav.payments",
    icon: <IconCard />,
  },
  {
    href: "/account",
    labelKey: "nav.account",
    icon: <IconUser />,
  },
];

// A teacher or admin in parent mode: the way back to their own pages.
const BACK = {
  teacher: {
    href: "/teacher",
    labelKey: "nav.teacherMode",
    icon: <IconBookOpen />,
  },
  admin: {
    href: "/admin",
    labelKey: "nav.office",
    icon: <IconBuildings />,
  },
} as const;

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  useRequirePasswordChange();
  const { blocked } = useSignInGuard();
  const { role } = useMyChildren();
  const back = role === "teacher" || role === "admin" ? BACK[role] : null;
  const items = back ? [...NAV.slice(0, -1), back, NAV[NAV.length - 1]] : NAV;

  return (
    <div className="flex min-h-screen bg-surface-bg">
      <SidebarNav items={items} roleKey={back ? "nav.parentMode" : "role.parent"} />
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-24 md:pb-8 overflow-auto">{blocked ? null : <PageFade>{children}</PageFade>}</main>
    </div>
  );
}
