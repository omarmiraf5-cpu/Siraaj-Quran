"use client";

import { useState } from "react";
import { getSurahData, getAllSurahsList, SurahData } from "@/data/quran-text";
import { getLetterRules, TajweedRule, TAJWEED_RULES } from "@/lib/tajweed-rules";

interface TajweedMushafProps {
  surahNumber?: number;
  highlightedAyahs?: { start: number; end: number };
  showSurahPicker?: boolean;
  showTajweed?: boolean;
}

function TajweedTooltip({
  rules,
  children,
}: {
  rules: TajweedRule[];
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (rules.length === 0) {
    return <>{children}</>;
  }

  const primaryRule = rules[0];

  return (
    <span className="relative inline">
      <span
        className={`cursor-help ${primaryRule.color} transition-all`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onTouchStart={() => setShowTooltip(true)}
        onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
      >
        {children}
      </span>

      {showTooltip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg p-2.5 whitespace-nowrap pointer-events-none shadow-lg"
        >
          <span className="font-semibold">{primaryRule.name}</span>
          <br />
          <span className="opacity-80">{primaryRule.description}</span>
        </span>
      )}
    </span>
  );
}

function TajweedLegend() {
  const rules = Object.values(TAJWEED_RULES);
  return (
    <div className="bg-surface-card rounded-2xl border border-surface-border p-4">
      <p className="text-xs font-semibold text-ink-muted mb-3">TAJWEED COLOR KEY</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2 text-xs">
            <span className={`inline-block w-3 h-3 rounded-full ${rule.bgColor} border ${rule.color.includes("red") ? "border-red-300" : rule.color.includes("blue") ? "border-blue-300" : rule.color.includes("amber") ? "border-amber-300" : rule.color.includes("green") ? "border-green-300" : rule.color.includes("purple") ? "border-purple-300" : rule.color.includes("orange") ? "border-orange-300" : rule.color.includes("pink") ? "border-pink-300" : "border-indigo-300"}`} />
            <span className="text-ink">{rule.name}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-ink-muted mt-3 italic">
        Hover (or tap) colored letters to see the rule
      </p>
    </div>
  );
}

export function TajweedMushaf({
  surahNumber: initialSurah,
  highlightedAyahs,
  showSurahPicker = false,
  showTajweed = true,
}: TajweedMushafProps) {
  const [selectedSurah, setSelectedSurah] = useState(initialSurah ?? 1);
  const surahList = getAllSurahsList();
  const surah = getSurahData(selectedSurah);

  const isHighlighted = (ayahNumber: number) => {
    if (!highlightedAyahs) return false;
    return ayahNumber >= highlightedAyahs.start && ayahNumber <= highlightedAyahs.end;
  };

  const renderTajweedText = (text: string) => {
    if (!showTajweed) return text;

    return text.split("").map((char, idx) => {
      const rules = getLetterRules(char);
      if (rules.length === 0) return <span key={idx}>{char}</span>;

      const primaryRule = rules[0];
      return (
        <TajweedTooltip key={idx} rules={rules}>
          <span className={primaryRule.color}>{char}</span>
        </TajweedTooltip>
      );
    });
  };

  if (!surah) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">📖</p>
        <p className="text-ink-muted">This Surah is not available offline yet.</p>
        <p className="text-xs text-ink-muted mt-2">Available: Al-Fatiha, Ad-Duha through An-Nas (Juz Amma)</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Surah Picker */}
      {showSurahPicker && (
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Select Surah</label>
          <select
            value={selectedSurah}
            onChange={(e) => setSelectedSurah(parseInt(e.target.value))}
            className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
          >
            {surahList.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.englishName} — {s.name} ({s.numberOfAyahs} Ayahs)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Surah Header */}
      <div className="text-center py-5 border-b border-surface-border">
        <p className="font-arabic text-2xl text-ink mb-1">{surah.name}</p>
        <h2 className="text-xl font-bold text-ink">{surah.englishName}</h2>
        <p className="text-sm text-ink-muted">
          {surah.englishNameTranslation} — {surah.numberOfAyahs} Ayahs — {surah.revelationType}
        </p>
        {highlightedAyahs && (
          <div className="mt-3 inline-block bg-amber-100 dark:bg-amber-900/30 rounded-full px-4 py-1.5">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Lesson: Ayahs {highlightedAyahs.start}–{highlightedAyahs.end}
            </p>
          </div>
        )}
      </div>

      {/* Bismillah */}
      {surah.number !== 1 && surah.number !== 9 && (
        <div className="text-center py-3">
          <p className="font-arabic text-xl text-ink/70" dir="rtl" lang="ar">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        </div>
      )}

      {/* Tajweed Legend */}
      {showTajweed && <TajweedLegend />}

      {/* Ayahs */}
      <div className="space-y-3">
        {surah.ayahs.map((ayah) => {
          const highlighted = isHighlighted(ayah.number);
          return (
            <div
              key={ayah.number}
              className={`rounded-2xl p-4 transition-all ${
                highlighted
                  ? "bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 shadow-sm"
                  : "bg-surface-card border border-surface-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Ayah number */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  highlighted
                    ? "bg-amber-200 dark:bg-amber-800/50"
                    : "bg-emerald-100 dark:bg-emerald-900/30"
                }`}>
                  <span className={`text-xs font-bold ${
                    highlighted
                      ? "text-amber-900 dark:text-amber-200"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {ayah.number}
                  </span>
                </div>

                {/* Arabic text */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-2xl leading-[2.2] font-arabic"
                    dir="rtl"
                    lang="ar"
                  >
                    {renderTajweedText(ayah.text)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {highlightedAyahs && (
        <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 text-center">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            The highlighted Ayahs above are the assigned lesson
          </p>
        </div>
      )}
    </div>
  );
}
