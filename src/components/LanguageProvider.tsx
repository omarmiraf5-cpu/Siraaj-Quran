"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translations, RTL_LANGUAGES, type Language } from "@/lib/i18n/translations";

const STORAGE_KEY = "language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyToDocument(lang: Language) {
  const dir = RTL_LANGUAGES.includes(lang) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

// Starts as "en" to match the server-rendered markup, then corrects itself
// on mount — the same flash-of-default tradeoff next-themes accepts for
// dark mode in this app, for the same reason: there's no reading a
// browser's localStorage (or a signed-in user's saved preference) before
// the client has mounted.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    let cancelled = false;

    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && translations[stored]) {
      setLanguageState(stored);
      applyToDocument(stored);
    }

    // A signed-in account's own saved choice wins over whatever this
    // particular browser has locally — it's the one that should follow
    // them between devices.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      const remote = user?.user_metadata?.language as Language | undefined;
      if (remote && translations[remote]) {
        setLanguageState(remote);
        applyToDocument(remote);
        localStorage.setItem(STORAGE_KEY, remote);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    applyToDocument(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private browsing or a full quota — the choice still applies for
      // this visit, it just won't be remembered next time.
    }
    // Best-effort: a guest or demo session has no account to save this to.
    createClient().auth.updateUser({ data: { language: lang } }).catch(() => {});
  };

  const t = (key: string) => translations[language]?.[key] ?? translations.en[key] ?? key;
  const dir = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
