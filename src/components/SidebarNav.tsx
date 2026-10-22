"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SchoolSwitcher } from "@/components/SchoolSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useMyName } from "@/hooks/useMyName";
import { forgetPushToken } from "@/components/NativeBridge";
import { useSchoolBranding, type SchoolBranding } from "@/hooks/useSchoolBranding";
import { useRecordVisit } from "@/hooks/useRecordVisit";
import { useSwitchedOffGuard } from "@/hooks/useSwitchedOffGuard";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { pillSpring } from "@/lib/motion-config";
import { ColorTile, type ArtName } from "@/components/gem-icons";

interface NavItem {
  href: string;
  /** Key into the translation dictionary, e.g. "nav.dashboard" — not literal text. */
  labelKey: string;
  icon?: React.ReactNode;
  /** A distinct Lucide glyph. When set, this replaces a plain icon. */
  mark?: LucideIcon;
  /** Illustrated gem tile. Preferred over mark and icon. */
  art?: ArtName;
  /** The heading this item sits under in the sidebar, in English (translated with tr). */
  section?: string;
}

interface SidebarNavProps {
  items: NavItem[];
  /** Key into the translation dictionary, e.g. "role.teacher". */
  roleKey: string;
  /** Overrides the name shown under the role — falls back to the
      translated role itself (every caller used to pass its own role
      string here again, which just duplicated `role` in English). */
  userName?: string;
  portalLinks?: NavItem[];
}

// Above four visible tabs plus "More", the labels start touching each
// other — a portal with six or seven destinations was cramming every one
// into an equal-width column with no room to breathe. Past that count the
// less-frequently-opened items move into a sheet behind a fifth "More" tab
// instead, which is how every mobile app with this many destinations
// handles it.
const MAX_PRIMARY_TABS = 4;

function NavIcon({ item, size, glow = false }: { item: NavItem; size: number; glow?: boolean }) {
  if (item.art) return <ColorTile name={item.art} size={size} glow={glow} />;
  if (item.mark) {
    const Icon = item.mark;
    return <Icon size={Math.max(18, size - 10)} strokeWidth={1.75} color="#102A56" aria-hidden />;
  }
  return <span className="text-[#102A56] dark:text-ink">{item.icon}</span>;
}

// A school's own name replaces the platform wordmark wholesale; only the
// MyDiiwaan default gets the two-tone "My"/"Diiwaan" split.
function Wordmark({ branding, className, onDark = false }: { branding: SchoolBranding; className: string; onDark?: boolean }) {
  return (
    <span className={className}>
      {branding.isCustom ? (
        <span className={onDark ? "gold-foil" : "text-brand-gold-dark"}>{branding.name}</span>
      ) : (
        <>
          <span className={onDark ? "text-white" : "text-ink"}>My</span>
          <span className={onDark ? "gold-foil" : "text-brand-gold-dark dark:text-brand-gold-light"}>Diiwaan</span>
        </>
      )}
    </span>
  );
}

// A school's logo can live on any host they like, so this stays a plain
// <img> rather than next/image, which would need every one of those hosts
// declared in next.config up front.
function Crest({ branding, size, className }: { branding: SchoolBranding; size: number; className: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={branding.logoUrl}
        alt={branding.name}
        width={size}
        height={size}
        // The MyDiiwaan crest is drawn to fill its slot, its dark ground
        // running to the edges; a school's own logo is artwork with its own
        // margins, so it gets fitted rather than cropped. Which one this is
        // goes by whether the school has a logo of its own, not by whether
        // a school is signed in: one that hasn't uploaded a logo still shows
        // the crest, and fitted it came out small, between white bars.
        className={`w-full h-full ${branding.hasOwnLogo ? "object-contain bg-white" : "object-cover"}`}
      />
    </div>
  );
}

export function SidebarNav({ items, roleKey, userName, portalLinks }: SidebarNavProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const demoUser = useDemoUser();
  const branding = useSchoolBranding();
  const { t, tr } = useLanguage();
  const reduce = useReducedMotion();
  useRecordVisit();
  useSwitchedOffGuard();
  const role = t(roleKey);
  const myName = useMyName();
  const displayName = demoUser?.name ?? myName ?? userName ?? role;
  const [moreOpen, setMoreOpen] = useState(false);

  // The sheet lives in the layout, which stays mounted across pages. Close
  // it whenever the route changes so a chosen item doesn't leave it open.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const showOverflow = items.length > MAX_PRIMARY_TABS + 1;
  const primaryItems = showOverflow ? items.slice(0, MAX_PRIMARY_TABS) : items;
  const moreItems = showOverflow ? items.slice(MAX_PRIMARY_TABS) : [];
  const moreActive = moreItems.some((item) => pathname === item.href);

  const handleSignOut = async () => {
    localStorage.removeItem("demo_user");
    document.cookie = "demo_mode=; path=/; max-age=0";
    // Before the session ends, so the portal knows whose phone to stop.
    await forgetPushToken();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const confirmSignOut = () => {
    if (!window.confirm(t("common.signOutConfirm"))) return;
    void handleSignOut();
  };

  return (
    <>
      {/* ── MOBILE TOP BAR ── */}
      <header className="md:hidden fixed top-[env(safe-area-inset-top)] start-0 end-0 z-50 bg-white/80 dark:bg-[#101722]/85 backdrop-blur-xl flex items-center justify-between px-3 h-14 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Crest
            branding={branding}
            size={32}
            className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-brand-gold/50 flex-shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <Wordmark branding={branding} onDark={false} className="block font-display text-sm font-bold tracking-tight truncate" />
            <span className="block text-ink-muted text-[11px] font-medium truncate">{demoUser?.name ?? myName ?? role}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <SchoolSwitcher variant="topbar" enabled={!demoUser} />
          <LanguageToggle variant="icon" className="min-w-11 min-h-11 bg-brand-navy/5 text-ink hover:bg-brand-navy/10" />
          <ThemeToggle variant="pill" className="min-h-11 bg-brand-navy/5 text-ink hover:bg-brand-navy/10" />
          <button
            onClick={confirmSignOut}
            className="w-11 h-11 rounded-full bg-brand-navy/5 flex items-center justify-center text-ink hover:bg-brand-navy/10 transition active:scale-95"
            aria-label={t("common.signOut")}
            title={t("common.signOut")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-50 safe-area-bottom pointer-events-none">
      <nav className="dock pointer-events-auto mx-auto flex max-w-lg rounded-[28px] p-1.5">
        {primaryItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-w-0 flex flex-col items-center justify-start min-h-12 pt-1.5 pb-1 gap-0.5 rounded-[20px] text-[11px] max-[359px]:text-[9px] max-[359px]:tracking-tight leading-tight text-center font-semibold break-words transition-all ${
                active ? "dock-pill text-[#1c1408]" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span style={{ opacity: 1 }}>
                <NavIcon item={item} size={28} glow />
              </span>
              {t(item.labelKey)}
            </Link>
          );
        })}
        {showOverflow && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex-1 min-w-0 flex flex-col items-center justify-start min-h-12 pt-1.5 pb-1 gap-0.5 rounded-[20px] text-[11px] max-[359px]:text-[9px] max-[359px]:tracking-tight leading-tight text-center font-semibold break-words transition-all ${
              moreActive || moreOpen ? "dock-pill text-[#1c1408]" : "text-ink-muted hover:text-ink"
            }`}
          >
            <span style={{ opacity: 1 }}>
              <ColorTile name="more" size={28} glow />
            </span>
            {t("common.more")}
          </button>
        )}
      </nav>
      </div>

      {/* ── MOBILE "MORE" SHEET ── */}
      {showOverflow && moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="sheet-in md:hidden fixed bottom-24 start-3 end-3 z-50 bg-white/95 dark:bg-[#141b28]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[22px] shadow-e3 p-2">
            {moreItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 min-h-11 px-3 rounded-2xl text-sm font-medium transition-colors active:scale-[.99] ${
                    active ? "dock-pill" : "text-ink hover:bg-brand-navy/5"
                  }`}
                >
                  <span style={{ opacity: 1 }}>
                    <NavIcon item={item} size={28} glow />
                  </span>
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-60 h-screen h-[100dvh] sticky top-0 self-start overflow-y-auto no-scrollbar bg-[#F9F8F3] dark:bg-[#101722] text-ink p-3 gap-1 flex-shrink-0 border-e border-[#E4E2DC] dark:border-white/10">
        <div className="hidden md:flex flex-col items-center gap-3 px-2 pt-6 pb-4 mb-1">
          <Crest
            branding={branding}
            size={112}
            className="w-28 h-28 rounded-2xl overflow-hidden ring-1 ring-brand-gold/60 shadow-dark flex-shrink-0"
          />
          <div className="flex flex-col items-center gap-1">
            <Wordmark
              branding={branding}
              onDark={false}
              className="font-display text-lg font-bold tracking-tight leading-tight text-center"
            />
            {branding.nameArabic && (
              <span className="font-calligraphy font-bold text-2xl text-brand-gold-dark leading-none" dir="rtl" lang="ar">
                {branding.nameArabic}
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:block px-2 mb-1">
          <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{role}</p>
          <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{displayName}</p>
        </div>
        <div className="hidden md:block">
          <SchoolSwitcher variant="sidebar" enabled={!demoUser} />
        </div>

        <div className="hidden md:block border-t border-black/5 dark:border-white/10 pt-3 pb-1 space-y-0.5">
          <ThemeToggle
            variant="labeled"
            className="text-ink-muted hover:text-ink hover:bg-brand-navy/5"
          />
          <LanguageToggle
            variant="labeled"
            className="text-ink-muted hover:text-ink hover:bg-brand-navy/5"
          />
        </div>

        <nav className="space-y-0.5 border-t border-black/5 dark:border-white/10 pt-3">
          {items.map((item, i) => {
            const active = pathname === item.href;
            const heading = item.section && item.section !== items[i - 1]?.section ? item.section : null;
            const gap = !item.section && items[i - 1]?.section;
            return (
              <Fragment key={item.href}>
                {heading && (
                  <p className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted px-3 pb-1 ${i === 0 ? "pt-0.5" : "pt-3"}`}>{tr(heading)}</p>
                )}
                {gap && <div aria-hidden className="border-t border-black/5 dark:border-white/10 my-2" />}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 min-h-12 px-2.5 rounded-xl text-sm font-semibold text-[#102A56] dark:text-ink ${
                    active ? "bg-[#F3EFE3] dark:bg-white/10" : "hover:bg-[#F4F1E8] dark:hover:bg-white/5"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-accent"
                      aria-hidden
                      className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[#c6a15a]"
                      transition={reduce ? { duration: 0 } : pillSpring}
                    />
                  )}
                  <span className="flex-shrink-0 inline-flex" style={{ opacity: active ? 1 : 0.9 }}>
                    <NavIcon item={item} size={32} glow={active} />
                  </span>
                  <span className="leading-snug break-words">{t(item.labelKey)}</span>
                </Link>
              </Fragment>
            );
          })}
        </nav>

        <button
          onClick={confirmSignOut}
          title={t("common.signOut")}
          className="flex items-center gap-3 min-h-11 px-3 rounded-xl text-sm font-medium text-[#102A56] dark:text-ink hover:bg-slate-100 dark:hover:bg-white/5 transition-colors mt-2"
        >
          <LogOut size={20} strokeWidth={1.75} aria-hidden />
          <span>{t("common.signOut")}</span>
        </button>

        {portalLinks && portalLinks.length > 0 && (
          <div className="flex-1 border-t border-black/5 dark:border-white/10 pt-3 mt-2">
            <p className="text-xs text-ink-muted uppercase tracking-wider px-3 mb-1.5">{t("common.switchPortal")}</p>
            {portalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium text-ink-muted hover:text-ink hover:bg-brand-navy/5 transition-all"
              >
                <NavIcon item={item} size={24} />
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
