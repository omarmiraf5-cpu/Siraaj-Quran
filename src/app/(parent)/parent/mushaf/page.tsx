"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function ParentMushafPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Mushaf</h1>
        <p className="text-ink-muted">Read along with your child&apos;s Quranic lessons</p>
      </div>

      <div className="bg-surface-card rounded-3xl border border-surface-border p-6 overflow-hidden">
        <TajweedMushaf showSurahPicker showTajweed />
      </div>
    </div>
  );
}
