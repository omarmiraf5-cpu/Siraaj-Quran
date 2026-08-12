"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function StudentQuranPage() {
  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Quran</h1>
        <p className="text-ink-muted">Read and memorize with Tajweed highlighting</p>
      </div>

      <div className="bg-surface-card rounded-3xl border border-surface-border p-5 overflow-hidden">
        <TajweedMushaf showSurahPicker showTajweed />
      </div>
    </div>
  );
}
