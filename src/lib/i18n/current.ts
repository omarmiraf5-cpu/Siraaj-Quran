import type { Language } from "@/lib/i18n/translations";

/*
 * The language being shown, for code that runs during render but isn't a
 * component — date and label helpers in lib/. The LanguageProvider sets it
 * as it renders, before any of its children, so a helper called while a
 * component renders reads the same language that component's `tr` does.
 * On the server it is always English, matching the first client render.
 */
let current: Language = "en";

export function setCurrentLanguage(language: Language) {
  current = language;
}

export function currentLanguage(): Language {
  return current;
}

/** The locale for Intl date formatting: Arabic month names, but the same
 *  0–9 digits the rest of the page uses. `en` is the caller's own English
 *  locale, so English output stays exactly as it was. */
export function dateLocale(en: string): string {
  return current === "ar" ? "ar-u-nu-latn" : en;
}
