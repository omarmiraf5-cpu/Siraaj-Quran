"use client";

import { Mushaf } from "@/components/Mushaf";

export default function StudentQuranPage() {
  // The Mushaf is the page. Chrome above it is kept to a single line so the
  // spread gets the height it needs on a phone.
  return (
    <div className="px-3 pt-4 pb-2 space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="page-title text-xl">Mushaf</h1>
        <span className="eyebrow">Madinah script</span>
      </div>
      <Mushaf />
    </div>
  );
}
