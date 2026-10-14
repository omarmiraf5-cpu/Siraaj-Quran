"use client";

import { SidebarNav } from "@/components/SidebarNav";
import { useSignInGuard } from "@/hooks/useSignInGuard";
import { useRequirePasswordChange } from "@/hooks/useRequirePasswordChange";
import { useMyChildren } from "@/hooks/useMyChildren";

const NAV = [
  {
    href: "/parent",
    labelKey: "nav.dashboard",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/parent/mushaf",
    labelKey: "nav.mushaf",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>,
  },
  {
    href: "/parent/quran-progress",
    labelKey: "nav.progress",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
  {
    href: "/parent/class-work",
    labelKey: "nav.classWork",
    // Islamic Studies and Arabic: a worksheet with lines of writing.
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h5"/></svg>,
  },
  {
    href: "/parent/yearly-plan",
    labelKey: "nav.yearlyPlan",
    // A milestone track: a rule with three stops. Geometric by
    // construction — the module carries no figurative marks anywhere.
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18"/><circle cx="6.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="17.5" cy="12" r="2"/></svg>,
  },
  {
    href: "/parent/attendance",
    labelKey: "nav.attendance",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>,
  },
  {
    href: "/parent/messages",
    labelKey: "nav.messages",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  },
  {
    href: "/parent/payments",
    labelKey: "nav.payments",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  },
  {
    href: "/account",
    labelKey: "nav.account",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  },
];

// A teacher or admin in parent mode: the way back to their own pages.
const BACK = {
  teacher: {
    href: "/teacher",
    labelKey: "nav.teacherMode",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8.5 4.4 4 4.4v13.2c4.5 0 6.5.6 8 2.1 1.5-1.5 3.5-2.1 8-2.1V4.4c-4.5 0-6.5.6-8 2.1Z"/><path d="M12 6.5v13.2"/></svg>,
  },
  admin: {
    href: "/admin",
    labelKey: "nav.office",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M10 21v-5h4v5"/></svg>,
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
      <main className="flex-1 px-4 md:px-8 pt-20 md:pt-10 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 overflow-auto">{blocked ? null : children}</main>
    </div>
  );
}
