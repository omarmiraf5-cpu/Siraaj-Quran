"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string;
  /** "icon" — bare button (default) | "labeled" — full row with switch | "pill" — compact icon + text */
  variant?: "icon" | "labeled" | "pill";
}

export function ThemeToggle({ className = "", variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={`${variant === "labeled" ? "h-10 w-full" : "w-8 h-8"} ${className}`} />;

  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  /* ── Compact pill: icon + text, good for tight spaces ── */
  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${className}`}
        aria-label="Toggle dark mode"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        {isDark ? "Light" : "Dark"}
      </button>
    );
  }

  /* ── Labeled row: icon + label + sliding pill switch ── */
  if (variant === "labeled") {
    return (
      <button
        onClick={toggle}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${className}`}
        aria-label="Toggle dark mode"
      >
        <span className="flex-shrink-0 opacity-80">
          {isDark ? <SunIcon /> : <MoonIcon />}
        </span>
        <span className="flex-1 text-left text-sm font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
        {/* iOS-style pill switch */}
        <span
          className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-300 ${
            isDark ? "bg-brand-gold" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
              isDark ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
    );
  }

  /* ── Icon only ── */
  return (
    <button
      onClick={toggle}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${className}`}
      aria-label="Toggle dark mode"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
