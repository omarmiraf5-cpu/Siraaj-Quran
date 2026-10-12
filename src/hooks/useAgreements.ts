"use client";

import { useCallback, useEffect, useState } from "react";
import type { Agreements } from "@/app/api/admin/agreements/route";

/** The school's agreements, for an admin's pages; null in the sample school or until loaded. */
export function useAgreements(enabled: boolean) {
  const [agreements, setAgreements] = useState<Agreements | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/admin/agreements")
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => a && setAgreements(a))
      .catch(() => {});
  }, [enabled]);
  const accept = useCallback(async (what: "terms" | "consent") => {
    setError(null);
    const res = await fetch("/api/admin/agreements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: what }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(body.error ?? "That didn't save. Please try again.");
      return false;
    }
    setAgreements(body);
    return true;
  }, []);
  return { agreements, accept, error };
}
