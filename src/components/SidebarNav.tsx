"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SchoolSwitcher } from "@/components/SchoolSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useSchoolBranding, type SchoolBranding } from "@/hooks/useSchoolBranding";
import { useRecordVisit } from "@/hooks/useRecordVisit";
import { useSwitchedOffGuard } from "@/hooks/useSwitchedOffGuard";
import type { LucideIcon } from "lucide-react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { IconSignOut } from "@/components/icons";
import { Sidebar } from "@/components/Sidebar";

interface NavItem {
  href: string;
  /** Key into the translation dictionary, e.g. "nav.dashboard" — not literal text. */
  labelKey: string;
  icon?: React.ReactNode;
  /** A distinct Lucide glyph. When set, this replaces the gold medallion. */
  mark?: LucideIcon;
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

// A school's own name replaces the platform wordmark wholesale; only the
// MyDiiwaan default gets the two-tone "My"/"Diiwaan" split.
function Wordmark({ branding, className, onDark = true }: { branding: SchoolBranding; className: string; onDark?: boolean }) {
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
  const { t } = useLanguage();
  useRecordVisit();
  useSwitchedOffGuard();
  const role = t(roleKey);
  const displayName = demoUser?.name ?? userName ?? role;
  const [moreOpen, setMoreOpen] = useState(false);

  const showOverflow = items.length > MAX_PRIMARY_TABS + 1;
  const primaryItems = showOverflow ? items.slice(0, MAX_PRIMARY_TABS) : items;
  const moreItems = showOverflow ? items.slice(MAX_PRIMARY_TABS) : [];
  const moreActive = moreItems.some((item) => pathname === item.href);

  const handleSignOut = async () => {
    localStorage.removeItem("demo_user");
    document.cookie = "demo_mode=; path=/; max-age=0";
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* ── MOBILE TOP BAR ── */}
      <header className="md:hidden fixed top-[env(safe-area-inset-top)] start-0 end-0 z-50 bg-white/80 dark:bg-[#101722]/85 backdrop-blur-xl flex items-center justify-between px-3 h-14 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <Crest
            branding={branding}
            size={32}
            className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-brand-gold/50 flex-shrink-0"
          />
          <Wordmark branding={branding} onDark={false} className="font-display text-sm font-bold tracking-tight truncate" />
          <span className="text-ink-muted text-xs font-medium flex-shrink-0">· {role}</span>
        </div>
        <div className="flex items-center gap-1">
          <SchoolSwitcher variant="topbar" enabled={!demoUser} />
          <LanguageToggle variant="icon" className="min-w-11 min-h-11 bg-brand-navy/5 text-ink hover:bg-brand-navy/10" />
          <ThemeToggle variant="pill" className="min-h-11 bg-brand-navy/5 text-ink hover:bg-brand-navy/10" />
          <button
            onClick={handleSignOut}
            className="w-11 h-11 rounded-full bg-brand-navy/5 flex items-center justify-center text-ink hover:bg-brand-navy/10 transition active:scale-95"
            aria-label={t("common.signOut")}
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
      <div className="hidden">
      <nav className="dock pointer-events-auto mx-auto flex max-w-lg rounded-[28px] p-1.5">
        {primaryItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center min-h-12 py-1 gap-0.5 rounded-[20px] text-[11px] font-semibold transition-all ${
                active ? "dock-pill" : "text-ink-muted hover:text-ink"
              }`}
            >
              {item.mark ? <item.mark size={20} strokeWidth={1.75} color="#102A56" aria-hidden /> : <span className="text-[#102A56]">{item.icon}</span>}
              {t(item.labelKey)}
            </Link>
          );
        })}
        {showOverflow && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex-1 flex flex-col items-center justify-center min-h-12 py-1 gap-0.5 rounded-[20px] text-[11px] font-semibold transition-all ${
              moreActive || moreOpen ? "dock-pill" : "text-ink-muted hover:text-ink"
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={1.75} color="#102A56" aria-hidden />
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
                  {item.mark ? <item.mark size={20} strokeWidth={1.75} color="#102A56" aria-hidden /> : <span className="text-[#102A56]">{item.icon}</span>}
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="flex flex-col w-16 md:w-60 min-h-screen sticky top-0 h-screen overflow-y-auto bg-[#FAFAFA] dark:bg-[#101722] text-ink p-2 md:p-3 gap-1 flex-shrink-0 border-e border-black/5 dark:border-white/10">
        {/* Logo + branding */}
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

        {/* User info */}
        <div className="hidden md:block px-2 mb-1">
          <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{role}</p>
          <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
        </div>
        <div className="hidden md:block">
          <SchoolSwitcher variant="sidebar" enabled={!demoUser} />
        </div>

        {/* Dark mode + language toggles — top of nav */}
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

        <div className="border-t border-black/5 dark:border-white/10 pt-3">
          <Sidebar
            activeHref={pathname}
            items={items.map((item) => ({
              href: item.href,
              label: t(item.labelKey),
              mark: item.mark,
              glyph: item.mark ? undefined : <span className="text-[#102A56]">{item.icon}</span>,
            }))}
          />
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 min-h-11 px-3 rounded-xl text-sm font-medium text-[#102A56] hover:bg-slate-100 transition-colors mt-2"
        >
          {items.some((item) => item.mark) ? <LogOut size={20} strokeWidth={1.75} color="#102A56" aria-hidden /> : <span className="text-[#102A56]"><IconSignOut size={20} /></span>}
          <span className="hidden md:inline">{t("common.signOut")}</span>
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
                {item.mark ? <item.mark size={20} strokeWidth={1.75} color="#102A56" aria-hidden /> : <span className="text-[#102A56]">{item.icon}</span>}
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
