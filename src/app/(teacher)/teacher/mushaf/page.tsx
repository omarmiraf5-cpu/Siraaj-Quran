"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function TeacherMushafPage() {
  return (
    <div className="px-4 pt-4 pb-20 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">📖 Mushaf</h1>
        <p className="text-sm text-ink-muted">Full Quran with Tajweed — Madinah Mushaf page numbers</p>
      </div>
      <TajweedMushaf />
    </div>
  );
}
