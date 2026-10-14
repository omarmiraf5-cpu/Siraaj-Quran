import { Fragment, createElement, type ReactNode } from "react";
import type { Language } from "@/lib/i18n/translations";
import { AR_PHRASES, type Plural } from "@/lib/i18n/phrases.ar";
import { currentLanguage } from "@/lib/i18n/current";

/*
 * The second half of the app's translations. `t("key")` covers the screens
 * written against the keyed dictionary; everything else is written in
 * English and passed through `tr("English text", vars)`, which looks the
 * text itself up here. A missing entry shows the English, so nothing ever
 * goes blank — `npm run i18n:check` lists what has no Arabic yet.
 *
 * Placeholders are written {name}. A value that is a React element (a link,
 * a bold name) makes tr return a node instead of a string. An entry can be
 * a Plural, chosen by the count (the `count` or `n` placeholder) the way
 * Arabic counts: one, two, few (3–10), many (11–99), other. The English
 * text of a counted phrase is "one|other": tr("{n} student|{n} students").
 */

export type PhraseVars = Record<string, ReactNode>;
export type Translated<V> = V extends Record<string, string | number | null | undefined> | undefined ? string : ReactNode;

const DICTS: Partial<Record<Language, Record<string, string | Plural>>> = { ar: AR_PHRASES };

const rules = new Map<Language, Intl.PluralRules>();
function countOf(vars: PhraseVars | undefined): number {
  // The first number: {count}, then {n}, then any — a bolded count can be
  // passed as {count} with its number as {n}.
  const all = [vars?.count, vars?.n, ...Object.values(vars ?? {})];
  return Number(all.find((v) => typeof v === "number"));
}

function pluralOf(language: Language, entry: Plural, vars: PhraseVars | undefined): string {
  const n = countOf(vars);
  if (!Number.isFinite(n)) return entry.other;
  if (!rules.has(language)) rules.set(language, new Intl.PluralRules(language));
  const form = rules.get(language)!.select(n) as keyof Plural;
  return entry[form] ?? entry.other;
}

export function translatePhrase<V extends PhraseVars | undefined>(language: Language, text: string, vars?: V): Translated<V> {
  const entry = DICTS[language]?.[text];
  const chosen =
    entry === undefined
      ? text.includes("|")
        ? text.split("|")[countOf(vars) === 1 ? 0 : 1]
        : text
      : typeof entry === "string"
        ? entry
        : pluralOf(language, entry, vars);
  if (!vars) return chosen as Translated<V>;
  const values = vars as PhraseVars;
  const plain = Object.values(values).every((v) => v === null || v === undefined || typeof v === "string" || typeof v === "number");
  if (plain) {
    return chosen.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k] ?? "") : m)) as Translated<V>;
  }
  const parts = chosen.split(/\{(\w+)\}/);
  return createElement(
    Fragment,
    null,
    ...parts.map((p, i) => (i % 2 === 1 ? createElement(Fragment, { key: i }, p in values ? values[p] : `{${p}}`) : p)),
  ) as Translated<V>;
}

/** tr for helpers outside components — see lib/i18n/current. */
export function phrase<V extends PhraseVars | undefined = undefined>(text: string, vars?: V): Translated<V> {
  return translatePhrase(currentLanguage(), text, vars);
}

/**
 * A fixed set of labels ({ cash: "Cash", … }) that reads in the current
 * language wherever it's used: each value is looked up as it's read.
 */
export function labels<K extends string>(english: Record<K, string>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(english) as K[]) {
    Object.defineProperty(out, k, { enumerable: true, get: () => phrase(english[k]) });
  }
  return out;
}

/**
 * Makes text fields of fixed reference data (a rule's name and description)
 * read in the current language, like labels() does for a map.
 */
export function translateFields<T extends object>(item: T, fields: (keyof T & string)[]): T {
  for (const f of fields) {
    const english = item[f];
    if (typeof english !== "string") continue;
    Object.defineProperty(item, f, { enumerable: true, configurable: true, get: () => phrase(english) });
  }
  return item;
}

/** Every phrase with an Arabic entry — for the check script. */
export const PHRASE_LANGUAGES = DICTS;
