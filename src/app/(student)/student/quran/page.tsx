"use client";

import { TajweedMushaf } from "@/components/TajweedMushaf";

export default function StudentQuranPage() {
  return (
    <div className="px-3 pt-3 pb-16 space-y-2">
      <h1 className="text-lg font-bold text-ink">📖 Quran</h1>
      <TajweedMushaf />
    </div>
  );
}
