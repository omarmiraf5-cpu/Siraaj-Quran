"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDemoUser } from "@/hooks/useDemoUser";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarNavProps {
  items: NavItem[];
  role: string;
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

export function SidebarNav({ items, role, userName = "User", portalLinks }: SidebarNavProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const demoUser = useDemoUser();
  const displayName = demoUser?.name ?? userName;
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 gradient-navy flex items-center justify-between px-4 h-14 shadow-dark">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-brand-gold/60 flex-shrink-0">
            <Image src="/crest.jpg" alt="MyDiiwaan" width={32} height={32} className="object-cover w-full h-full" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight">
            <span className="text-white/90">My</span>
            <span className="gold-foil">Diiwaan</span>
          </span>
          <span className="text-white/30 text-xs font-medium">· {role}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle variant="pill" className="bg-white/10 text-white/70 hover:bg-white/20" />
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition"
            aria-label="Sign out"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-brand-navy border-t border-white/10 flex safe-area-bottom">
        {primaryItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold transition-colors ${
                active ? "text-brand-gold" : "text-white/45 hover:text-white/80"
              }`}
            >
              <span className={active ? "text-brand-gold" : ""}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        {showOverflow && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold transition-colors ${
              moreActive || moreOpen ? "text-brand-gold" : "text-white/45 hover:text-white/80"
            }`}
          >
            <span className={moreActive || moreOpen ? "text-brand-gold" : ""}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </span>
            More
          </button>
        )}
      </nav>

      {/* ── MOBILE "MORE" SHEET ── */}
      {showOverflow && moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed bottom-14 left-0 right-0 z-50 bg-brand-navy border-t border-white/10 rounded-t-2xl shadow-dark p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {moreItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active ? "bg-white/15 text-brand-gold" : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen gradient-navy text-white p-4 gap-2 flex-shrink-0">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-3 px-2 pt-6 pb-4 mb-1">
          <div className="w-28 h-28 rounded-2xl overflow-hidden ring-1 ring-brand-gold/60 shadow-dark flex-shrink-0">
            <Image src="/crest.jpg" alt="MyDiiwaan" width={112} height={112} className="object-cover w-full h-full" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-lg font-bold tracking-tight leading-tight text-center">
              <span className="text-white">My</span>
              <span className="gold-foil">Diiwaan</span>
            </span>
            <span className="font-calligraphy font-bold text-2xl text-brand-gold-light leading-none" dir="rtl" lang="ar">
              ديواني
            </span>
          </div>
        </div>

        {/* User info */}
        <div className="px-2 mb-1">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{role}</p>
          <p className="text-sm font-semibold text-white/90 truncate">{displayName}</p>
        </div>

        {/* Dark mode toggle — top of nav */}
        <div className="border-t border-white/10 pt-3 pb-1">
          <ThemeToggle
            variant="labeled"
            className="text-white/60 hover:text-white hover:bg-white/8"
          />
        </div>

        {/* Nav links */}
        <nav className="space-y-0.5 border-t border-white/10 pt-3">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                }`}
              >
                <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/8 transition-all border-t border-white/10 mt-2 pt-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>

        {portalLinks && portalLinks.length > 0 && (
          <div className="flex-1 border-t border-white/10 pt-3 mt-2">
            <p className="text-xs text-white/30 uppercase tracking-wider px-3 mb-1.5">Switch portal</p>
            {portalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/8 transition-all"
              >
                <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
