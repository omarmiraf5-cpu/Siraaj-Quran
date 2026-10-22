"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SURAHS, type SurahMeta } from "@/data/mushaf-index";
import { useLanguage } from "@/components/LanguageProvider";

// Folds the many ways a surah's name gets typed into one: "Al-Mulk",
// "al mulk", "mulk" and "almulk" all meet, as do "Yaseen" and "Ya-Sin".
function foldLatin(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/ee/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/aa/g, "a")
    .replace(/dh/g, "z")
    .replace(/q/g, "k");
}
// Arabic without its marks, and with the letters people type in place of one another.
function foldArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .replace(/\s+/g, "");
}

function rank(s: SurahMeta, q: string): number {
  const raw = q.trim();
  if (!raw) return 1;
  if (/^\d+$/.test(raw)) return String(s.id) === raw ? 100 : String(s.id).startsWith(raw) ? 50 : 0;
  if (/[؀-ۿ]/.test(raw)) {
    const a = foldArabic(s.name);
    const b = foldArabic(raw);
    return a === b ? 90 : a.startsWith(b) ? 70 : a.includes(b) ? 40 : 0;
  }
  const name = foldLatin(s.englishName);
  const bare = name.replace(/^(al|an|ar|as|at|ad|az|ash|aal)/, "");
  const want = foldLatin(raw).replace(/^(al|an|ar|as|at|ad|az|ash|aal)(?=..)/, "");
  if (!want) return 1;
  if (bare === want || name === want) return 90;
  if (bare.startsWith(want) || name.startsWith(want)) return 70;
  if (bare.includes(want)) return 40;
  if (foldLatin(s.translation).includes(foldLatin(raw))) return 20;
  return 0;
}

interface Props {
  /** The chosen surah's id as a string, or "" for none. */
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Only these surahs are offered (an end surah can't come before the start, say). */
  only?: SurahMeta[];
  /** "sm" for the mushaf's own toolbar. */
  size?: "md" | "sm";
  /** Leaves the box empty after a pick — for "jump to", which isn't a choice that stays. */
  clearAfterPick?: boolean;
  className?: string;
}

/**
 * Pick a surah by typing any part of it — "mulk", "67", "الملك", "the cow" —
 * rather than scrolling a list of 114. Arrow keys and Enter work as in any
 * search box; Escape puts the last choice back.
 */
export function SurahPicker({ value, onChange, placeholder, only, size = "md", clearAfterPick, className = "" }: Props) {
  const { tr } = useLanguage();
  const list = only ?? SURAHS;
  const chosen = SURAHS.find((s) => String(s.id) === value) ?? null;
  const label = (s: SurahMeta) => `${s.id}. ${s.englishName}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const matches = useMemo(() => {
    if (!query.trim()) return list;
    return list
      .map((s) => ({ s, r: rank(s, query) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r || a.s.id - b.s.id)
      .map((x) => x.s);
  }, [list, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (s: SurahMeta) => {
    onChange(String(s.id));
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const sm = size === "sm";
  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={open ? query : chosen && !clearAfterPick ? label(chosen) : ""}
        placeholder={open ? tr("Name or number — e.g. Mulk, 67, الملك") : placeholder ?? tr("Select a Surah")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            if (open && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        className={
          (chosen && !clearAfterPick && !open ? (sm ? "pe-20 " : "pe-36 ") : sm ? "pe-7 " : "pe-11 ") +
          (sm
            ? "w-full bg-surface-card border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            : "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition")
        }
      />
      {/* The chosen surah's Arabic name, at the end of the box. */}
      {chosen && !clearAfterPick && !open && (
        // Placed by the page's own direction (so it sits at the far end in
        // English and Arabic alike); only the name inside reads right to left.
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 flex items-center text-ink font-arabic ${sm ? "end-6 pe-1 text-[14px]" : "end-10 pe-1 text-[20px]"}`}
        >
          <bdi dir="rtl">{chosen.name}</bdi>
        </span>
      )}
      {/* Browse the whole list: the phone's own scrolling picker, for anyone who
          would rather scroll than type. */}
      <label
        className={`absolute inset-y-0 end-0 flex items-center justify-center text-ink-muted ${sm ? "w-6" : "w-10"}`}
        title={tr("Browse all surahs")}
      >
        <span aria-hidden className={sm ? "text-[10px]" : "text-[13px]"}>▾</span>
        <select
          aria-label={tr("Browse all surahs")}
          value={value}
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value);
              setOpen(false);
              setQuery("");
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          <option value="">{tr("Select a Surah")}</option>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id}. {x.englishName} ({x.ayahs} {tr("Ayahs")})
            </option>
          ))}
        </select>
      </label>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className={`absolute z-40 left-0 right-0 mt-1 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-surface-border bg-surface-card shadow-xl ${sm ? "max-h-64 min-w-[220px]" : "max-h-[min(20rem,42svh)]"}`}
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-[12.5px] text-ink-muted">{tr("No surah matches that.")}</li>
          ) : (
            matches.map((s, i) => (
              <li
                key={s.id}
                data-i={i}
                role="option"
                aria-selected={i === active}
                // A tap picks, a drag scrolls: pick on click (which a scroll never
                // fires), and stop the mouse press taking focus from the box.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onPointerEnter={() => setActive(i)}
                className={`flex items-center gap-3 cursor-pointer ${sm ? "px-2.5 py-1.5" : "px-3 py-2"} ${
                  i === active ? "bg-brand-navy/[.07] dark:bg-white/[.06]" : ""
                } ${String(s.id) === value ? "font-semibold" : ""}`}
              >
                <span className={`tabular-nums text-ink-muted ${sm ? "w-6 text-[11px]" : "w-7 text-[12.5px]"}`}>{s.id}</span>
                <span className={`flex-1 min-w-0 text-ink ${sm ? "text-[12px]" : "text-[14px]"}`}>
                  {s.englishName}
                  {!sm && <span className="text-ink-muted text-[12px]"> · {s.ayahs} {tr("Ayahs")}</span>}
                </span>
                <span dir="rtl" className={`font-arabic text-ink ${sm ? "text-[15px]" : "text-[18px]"}`}>{s.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
