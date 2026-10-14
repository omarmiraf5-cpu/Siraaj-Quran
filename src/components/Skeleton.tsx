"use client";

/*
 * Placeholders in the shape of what's loading, so a page keeps its layout
 * while it fills in rather than jumping from "Loading…" to content. Hidden
 * from screen readers; LoadingNote says "Loading" for them.
 */

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-quiet p-4 space-y-3">
          <div className="skeleton h-7 w-16" />
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-2.5 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="skeleton h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="skeleton h-3 w-40 max-w-[70%]" />
            <div className="skeleton h-2.5 w-56 max-w-full" />
          </div>
          <div className="skeleton h-5 w-14 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
