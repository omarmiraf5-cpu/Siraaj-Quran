"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function ParentMushafPage() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">📖 Mushaf</h1>
        <p className="text-sm text-ink-muted">Read along — Madinah Mushaf page numbers</p>
      </div>
      <TajweedMushaf />
    </div>
  );
}
