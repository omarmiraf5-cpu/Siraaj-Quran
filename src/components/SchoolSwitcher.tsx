"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// For a teacher at more than one school: which school they're in, and the
// others to switch into (/api/me/school). Shows nothing for anyone else.
// Switching reloads the portal, so everything on it is the new school's.

interface School {
  id: string;
  name: string;
  current: boolean;
}

function useMySchools(enabled: boolean) {
  const [schools, setSchools] = useState<School[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/api/me/school")
      .then((res) => (res.ok ? res.json() : { schools: [] }))
      .then((body) => live && setSchools(Array.isArray(body.schools) ? body.schools : []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return schools;
}

const SwitchIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h13a4 4 0 0 1 4 4" />
    <path d="m17 20 4-4-4-4" />
    <path d="M21 16H8a4 4 0 0 1-4-4" />
  </svg>
);

export function SchoolSwitcher({ variant, enabled }: { variant: "sidebar" | "topbar"; enabled: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const schools = useMySchools(enabled && pathname.startsWith("/teacher"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  if (schools.length < 2) return null;
  const current = schools.find((s) => s.current);

  const choose = async (school: School) => {
    if (school.current) {
      setOpen(false);
      return;
    }
    setBusy(school.id);
    setError(false);
    try {
      const res = await fetch("/api/me/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: school.id }),
      });
      if (!res.ok) throw new Error();
      window.location.assign("/teacher");
    } catch {
      setError(true);
      setBusy(null);
    }
  };

  const list = (
    <div role="menu" aria-label={t("common.yourSchools")} className="space-y-0.5">
      {schools.map((s) => (
        <button
          key={s.id}
          type="button"
          role="menuitemradio"
          aria-checked={s.current}
          onClick={() => choose(s)}
          disabled={busy !== null}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-start transition-colors disabled:opacity-60 ${
            s.current ? "bg-white/15 text-brand-gold font-semibold" : "text-white/75 hover:bg-white/8 hover:text-white"
          }`}
        >
          <span className="w-4 flex-shrink-0" aria-hidden="true">
            {s.current ? "✓" : ""}
          </span>
          <span className="min-w-0 truncate">
            <bdi>{busy === s.id ? t("common.switchingSchool") : s.name}</bdi>
          </span>
        </button>
      ))}
      {error && <p className="px-3 pt-1 text-xs text-red-200">{t("common.switchFailed")}</p>}
    </div>
  );

  if (variant === "topbar") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t("common.switchSchool")}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition"
        >
          <SwitchIcon />
        </button>
        {open && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="md:hidden fixed top-[calc(3.5rem+env(safe-area-inset-top))] start-0 end-0 z-50 bg-brand-navy border-b border-white/10 rounded-b-2xl shadow-dark p-2">
              <p className="px-3 pt-1 pb-1.5 text-[11px] uppercase tracking-wider text-white/40">{t("common.yourSchools")}</p>
              {list}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="px-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-start text-white/70 hover:text-white hover:bg-white/8 transition"
      >
        <SwitchIcon size={14} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wider text-white/40">{t("common.switchSchool")}</span>
          <span className="block text-[13px] font-semibold truncate">
            <bdi>{current?.name}</bdi>
          </span>
        </span>
        <span className="text-white/40 text-xs" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && <div className="mt-1">{list}</div>}
    </div>
  );
}
