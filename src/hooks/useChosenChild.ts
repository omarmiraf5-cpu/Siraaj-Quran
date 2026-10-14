"use client";

import { useEffect, useState } from "react";

const KEY = "parent_child";

/**
 * Which of a parent's children the page is showing. The choice carries
 * from page to page and across visits, so a parent of four who is following
 * the third doesn't land back on the first every time.
 */
export function useChosenChild<C extends { id: string; name: string }>(children: C[]) {
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    if (childId || children.length === 0) return;
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(KEY);
    } catch {}
    setChildId(children.find((c) => c.id === remembered)?.id ?? children[0].id);
  }, [children, childId]);

  const choose = (id: string) => {
    setChildId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  };

  const child = children.find((c) => c.id === childId) ?? children[0] ?? null;
  return { child, choose, options: childOptions(children) };
}

/** First names on the switch — or the full name where two children share one. */
export function childOptions(children: { id: string; name: string }[]) {
  const first = (name: string) => name.trim().split(/\s+/)[0];
  const seen = new Map<string, number>();
  for (const c of children) seen.set(first(c.name), (seen.get(first(c.name)) ?? 0) + 1);
  return children.map((c) => ({ value: c.id, label: (seen.get(first(c.name)) ?? 0) > 1 ? c.name : first(c.name) }));
}
