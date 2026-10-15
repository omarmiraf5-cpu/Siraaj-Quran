"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { verifiedUser } from "@/lib/supabase/sessionUser";
import { translations, loadTranslations, LANGUAGES, RTL_LANGUAGES, type Language } from "@/lib/i18n/translations";
import { setCurrentLanguage } from "@/lib/i18n/current";
import { translatePhrase, loadPhrases, type PhraseVars, type Translated } from "@/lib/i18n/phrases";

const STORAGE_KEY = "language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  /** Translates English UI text itself — see lib/i18n/phrases. */
  tr: <V extends PhraseVars | undefined = undefined>(text: string, vars?: V) => Translated<V>;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const known = (lang: string | null | undefined): lang is Language => LANGUAGES.some((l) => l.code === lang);

/** A language's text, fetched the first time it's chosen. */
const ready = (lang: Language) => Promise.all([loadTranslations(lang), loadPhrases(lang)]);

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

    // Switched to once its text has arrived, so it never shows half English.
    const switchTo = (lang: Language) =>
      ready(lang)
        .then(() => {
          if (cancelled) return;
          setLanguageState(lang);
          applyToDocument(lang);
        })
        .catch(() => {});

    const stored = localStorage.getItem(STORAGE_KEY);
    if (known(stored) && stored !== "en") switchTo(stored);

    // A signed-in account's own saved choice wins over whatever this
    // particular browser has locally — it's the one that should follow
    // them between devices.
    const supabase = createClient();
    verifiedUser(supabase).then(({ data: { user } }) => {
      if (cancelled) return;
      const remote = user?.user_metadata?.language as string | undefined;
      if (known(remote) && remote !== stored) {
        localStorage.setItem(STORAGE_KEY, remote);
        if (remote === "en") {
          setLanguageState("en");
          applyToDocument("en");
        } else switchTo(remote);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = (lang: Language) => {
    ready(lang)
      .then(() => {
        setLanguageState(lang);
        applyToDocument(lang);
      })
      .catch(() => {});
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private browsing or a full quota — the choice still applies for
      // this visit, it just won't be remembered next time.
    }
    // Best-effort: a guest or demo session has no account to save this to.
    createClient().auth.updateUser({ data: { language: lang } }).catch(() => {});
  };

  // Before the children render, so lib helpers they call agree with tr.
  setCurrentLanguage(language);

  const t = (key: string) => translations[language]?.[key] ?? translations.en[key] ?? key;
  const tr = <V extends PhraseVars | undefined = undefined>(text: string, vars?: V) => translatePhrase(language, text, vars);
  const dir = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tr, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
