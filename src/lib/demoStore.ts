// A read/write pair for the localStorage-backed "demo mode" writes scattered
// across the portals (created assignments, rating overrides, message
// threads). Centralised so each call site is one line instead of repeating
// the same try/catch around JSON.parse/stringify.

export function readDemoStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeDemoStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota — the change still applies for this
    // visit, it just will not survive a refresh.
  }
}
