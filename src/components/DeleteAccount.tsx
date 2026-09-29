"use client";

import { useState } from "react";

/**
 * "Delete permanently…" for a teacher's or parent's account, on the office's
 * Teachers and Parents pages: what it does, then the person's name typed to
 * confirm, as for a student.
 */
export function DeleteAccount({
  name,
  consequences,
  onDelete,
}: {
  name: string;
  /** What deleting this account does, in a sentence or two. */
  consequences: string;
  /** Deletes it; throws with a message to show if it didn't. */
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That account couldn't be deleted.");
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTyped("");
          setError(null);
        }}
        className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline"
      >
        Delete permanently…
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-ink leading-relaxed">
        {consequences} Type <span className="font-semibold">{name}</span> to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={name}
        aria-label={`Type ${name} to confirm`}
        className="w-full bg-surface-card border border-red-300 dark:border-red-800/60 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy || !matches}
          className="bg-red-700 text-white text-[12.5px] font-semibold px-3.5 py-2 rounded-xl disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-2"
        >
          Keep
        </button>
      </div>
      {error && <p className="text-[11.5px] text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/** Saves a teacher's or parent's name or on/off switch; throws with the reason if it didn't. */
export async function saveAccount(id: string, patch: { full_name?: string; active?: boolean }) {
  const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That didn't save. Please try again.");
  return data as { id: string; full_name: string; active: boolean };
}

/** Deletes a teacher's or parent's account; throws with the reason if it didn't. */
export async function deleteAccount(id: string) {
  const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That account couldn't be deleted.");
}
