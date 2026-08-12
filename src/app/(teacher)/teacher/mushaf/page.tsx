"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function TeacherMushafPage() {
  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Mushaf</h1>
        <p className="text-ink-muted">Browse the Quran with Tajweed highlighting</p>
      </div>

      <div className="bg-surface-card rounded-3xl border border-surface-border p-6 overflow-hidden">
        <TajweedMushaf showSurahPicker showTajweed />
      </div>
    </div>
  );
}
