import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/site";

/** How long the link in a teacher's or parent's welcome email works. */
export const WELCOME_LINK_DAYS = 14;
const DAY_MS = 86_400_000;

/*
 * The link in a new teacher's or parent's welcome email, which lets them
 * choose their own password. It carries who it's for and when it was made
 * and runs out, signed so it can't be forged or altered, rather than a
 * token kept in a table: nothing to store when a whole school's worth go
 * out at once. Supabase's own reset links would do the same, but they run
 * out within the hour, too soon for an email someone may open days later.
 *
 * Each works once: choosing a password through one stamps the account
 * (app_metadata.welcome_used_at, which only the service role can write),
 * and a link made before that stamp is spent.
 *
 * Signed with a key derived from the service-role key, which only this
 * server holds, so there's nothing more to set up.
 */
function signingKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY isn't set, so welcome links can't be signed.");
  return createHmac("sha256", secret).update("mydiiwaan welcome link v1").digest();
}

const signatureOf = (payload: string) => createHmac("sha256", signingKey()).update(payload).digest("base64url");

/** A link for this account, working for WELCOME_LINK_DAYS from now. */
export function makeWelcomeToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, iat: now, exp: now + WELCOME_LINK_DAYS * DAY_MS })).toString(
    "base64url"
  );
  return `${payload}.${signatureOf(payload)}`;
}

export type WelcomeTokenCheck =
  | { ok: true; userId: string; issuedAt: number }
  | { ok: false; reason: "invalid" | "expired" };

/** Whose link this is, if it's one of ours, unaltered and still in date. */
export function readWelcomeToken(token: unknown, now = Date.now()): WelcomeTokenCheck {
  const invalid = { ok: false, reason: "invalid" } as const;
  if (typeof token !== "string" || token.length > 1000) return invalid;
  const parts = token.split(".");
  if (parts.length !== 2) return invalid;
  const [payload, signature] = parts;
  try {
    const expected = Buffer.from(signatureOf(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return invalid;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.u !== "string" || !Number.isFinite(data?.iat) || !Number.isFinite(data?.exp)) return invalid;
    if (now > data.exp) return { ok: false, reason: "expired" };
    return { ok: true, userId: data.u, issuedAt: data.iat };
  } catch {
    return invalid;
  }
}

/** Whether a password has been chosen through a welcome link since this one was made. */
export function welcomeSpent(appMetadata: Record<string, unknown> | undefined, issuedAt: number): boolean {
  const used = Date.parse(String(appMetadata?.welcome_used_at ?? ""));
  return Number.isFinite(used) && used >= issuedAt;
}

/** Where the email's button goes: the page that takes the new password. */
export const welcomeLink = (token: string) => `${SITE_URL}/welcome?token=${encodeURIComponent(token)}`;
