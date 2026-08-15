"use client";

import { Mushaf } from "@/components/Mushaf";

export default function ParentMushafPage() {
  return (
    <div className="px-3 pt-3 pb-16 space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="page-title text-2xl">Mushaf</h1>
        <span className="eyebrow">Madinah script</span>
      </div>
      <Mushaf />
    </div>
  );
}
