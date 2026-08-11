"use client";

import { useEffect, useState } from "react";
import { getAyahs, getSurahByNumber, QuranAyah, QuranSurah } from "@/lib/quran-api";
import { getLetterRules, TajweedRule } from "@/lib/tajweed-rules";

interface TajweedMushafProps {
  surahNumber: number;
  highlightedAyahs?: { start: number; end: number };
  onLoadingChange?: (loading: boolean) => void;
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
    <div className="relative inline-block group">
      <span
        className={`cursor-help border-b-2 ${primaryRule.color} transition-all`}
        style={{ borderBottomColor: "currentColor" }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-ink-body text-white text-xs rounded-lg p-3 whitespace-nowrap pointer-events-none shadow-lg`}
        >
          <div className="font-semibold mb-1">{primaryRule.name}</div>
          <div className="text-xs opacity-90">{primaryRule.description}</div>
          {rules.length > 1 && (
            <div className="text-xs opacity-75 mt-1">
              +{rules.length - 1} more rule{rules.length > 2 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TajweedMushaf({
  surahNumber,
  highlightedAyahs,
  onLoadingChange,
  showTajweed = true,
}: TajweedMushafProps) {
  const [surah, setSurah] = useState<QuranSurah | null>(null);
  const [ayahs, setAyahs] = useState<QuranAyah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuran = async () => {
      try {
        setLoading(true);
        onLoadingChange?.(true);
        const [surahData, ayahsData] = await Promise.all([
          getSurahByNumber(surahNumber),
          getAyahs(surahNumber),
        ]);

        if (!surahData) {
          setError("Surah not found");
          return;
        }

        setSurah(surahData);
        setAyahs(ayahsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Quran");
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };

    loadQuran();
  }, [surahNumber, onLoadingChange]);

  const isHighlighted = (ayahNumber: number) => {
    if (!highlightedAyahs) return false;
    return (
      ayahNumber >= highlightedAyahs.start && ayahNumber <= highlightedAyahs.end
    );
  };

  const renderTajweedText = (text: string) => {
    if (!showTajweed) return text;

    return text.split("").map((char, idx) => {
      const rules = getLetterRules(char);
      if (rules.length === 0) return char;

      const primaryRule = rules[0];
      return (
        <TajweedTooltip key={idx} rules={rules}>
          <span className={primaryRule.color}>{char}</span>
        </TajweedTooltip>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-subject-blue/30 border-t-subject-blue animate-spin" />
          <p className="text-sm text-ink-muted">Loading Quran...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 p-4 text-center">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!surah || ayahs.length === 0) {
    return (
      <div className="text-center py-8 text-ink-muted">
        No Ayahs found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Surah header */}
      <div className="text-center py-6 border-b border-surface-border">
        <p className="text-sm text-ink-muted mb-1">
          Surah {surah.number} of 114
        </p>
        <h2 className="text-3xl font-bold text-ink mb-1">{surah.englishName}</h2>
        <p className="text-sm text-ink-muted">
          {surah.englishNameTranslation} • {surah.numberOfAyahs} Ayahs
        </p>
        {highlightedAyahs && (
          <div className="mt-3 inline-block bg-amber-100 dark:bg-amber-900/30 rounded-full px-3 py-1">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              📖 Homework: Ayahs {highlightedAyahs.start}-{highlightedAyahs.end}
            </p>
          </div>
        )}
      </div>

      {/* Tajweed Legend */}
      {showTajweed && (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4">
          <p className="text-xs font-semibold text-ink-muted mb-3">
            🎨 TAJWEED RULES
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>
              <span className="text-ink">Qalqalah</span>
            </div>
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
              <span className="text-ink">Ghunna</span>
            </div>
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
              <span className="text-ink">Idgham</span>
            </div>
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-ink">Iqlab</span>
            </div>
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
              <span className="text-ink">Istihaaza</span>
            </div>
            <div className="text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
              <span className="text-ink">Tafkhim</span>
            </div>
          </div>
          <p className="text-[10px] text-ink-muted mt-3 italic">
            Hover over colored letters to see rules
          </p>
        </div>
      )}

      {/* Quranic text */}
      <div className="space-y-4">
        {ayahs.map((ayah) => {
          const highlighted = isHighlighted(ayah.numberInSurah);
          return (
            <div
              key={ayah.number}
              className={`rounded-lg p-4 transition-all ${
                highlighted
                  ? "bg-amber-100 dark:bg-amber-900/25 border-2 border-amber-300 dark:border-amber-700"
                  : "bg-surface-card border border-surface-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Ayah number badge */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-subject-blue/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-subject-blue">
                    {ayah.numberInSurah}
                  </span>
                </div>

                {/* Ayah text - RTL with Tajweed coloring */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-lg leading-relaxed font-arabic"
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
        <div className="bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ✅ Complete these Ayahs before the due date
          </p>
        </div>
      )}
    </div>
  );
}
