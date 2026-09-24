const BASE = "https://mydiiwaan.invalid";

/**
 * The page a sign-in link asks to come back to (`/login?next=/platform`),
 * if it's a page on this site. Anything else is dropped, so the sign-in
 * page can't be used to send someone elsewhere once they've logged in.
 *
 * Checked by resolving it the way the browser will rather than by its
 * spelling alone: `//host`, `/\host`, or a tab slipped between the
 * slashes (which URL parsing strips) all lead off-site.
 */
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/")) return null;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}
