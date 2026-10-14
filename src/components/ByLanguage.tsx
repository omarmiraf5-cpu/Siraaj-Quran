"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * Shows `ar` when the page is in Arabic, otherwise `en` — for the public
 * information pages, which are server rendered and written out in full in
 * each language rather than phrase by phrase.
 */
export function ByLanguage({ en, ar }: { en: React.ReactNode; ar?: React.ReactNode }) {
  const { language } = useLanguage();
  return <>{language === "ar" && ar !== undefined ? ar : en}</>;
}
