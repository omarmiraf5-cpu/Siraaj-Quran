"use client";

import { Mushaf } from "@/components/Mushaf";

export default function ParentMushafPage() {
  return (
    <div className="px-3 pt-3 pb-16 space-y-2">
      <h1 className="text-lg font-bold text-ink">📖 Mushaf</h1>
      <Mushaf />
    </div>
  );
}
