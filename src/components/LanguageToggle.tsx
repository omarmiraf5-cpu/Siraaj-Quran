"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n/translations";

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

interface LanguageToggleProps {
  className?: string;
  /** "icon" — bare button (default) | "labeled" — full row | "pill" — compact icon + text */
  variant?: "icon" | "labeled" | "pill";
}

// Three options are simple enough to cycle through with a single button
// rather than opening a dropdown — each tap shows the language it just
// switched to, so the current choice is always visible on the button itself.
export function LanguageToggle({ className = "", variant = "icon" }: LanguageToggleProps) {
  const { language, setLanguage, t } = useLanguage();

  const cycle = () => {
    const i = LANGUAGES.findIndex((l) => l.code === language);
    setLanguage(LANGUAGES[(i + 1) % LANGUAGES.length].code);
  };

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  if (variant === "pill") {
    return (
      <button
        onClick={cycle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${className}`}
        aria-label={t("common.language")}
      >
        <GlobeIcon />
        {current.nativeLabel}
      </button>
    );
  }

  if (variant === "labeled") {
    return (
      <button
        onClick={cycle}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${className}`}
        aria-label={t("common.language")}
      >
        <span className="flex-shrink-0 opacity-80">
          <GlobeIcon />
        </span>
        <span className="flex-1 text-start text-sm font-medium">{t("common.language")}</span>
        <span className="text-xs font-semibold opacity-70">{current.nativeLabel}</span>
      </button>
    );
  }

  return (
    <button
      onClick={cycle}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${className}`}
      aria-label={t("common.language")}
    >
      <GlobeIcon />
    </button>
  );
}
