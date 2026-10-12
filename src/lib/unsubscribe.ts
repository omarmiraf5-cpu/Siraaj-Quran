import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/site";

// A parent's link out of the Friday emails: their id and a signature only
// this server can make, so the link unsubscribes that parent and no one
// else, without signing in.

const key = () => {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY isn't set");
  return k;
};
const sign = (profileId: string) => createHmac("sha256", key()).update(`weekly-reports:${profileId}`).digest("base64url").slice(0, 32);

export function unsubscribeToken(profileId: string): string {
  return sign(profileId);
}

export function validUnsubscribe(profileId: string, token: string): boolean {
  if (!profileId || !token) return false;
  const want = Buffer.from(sign(profileId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

const query = (profileId: string) => `u=${encodeURIComponent(profileId)}&t=${unsubscribeToken(profileId)}`;

/** The page a parent opens from the email, to confirm. */
export const unsubscribePageUrl = (profileId: string) => `${SITE_URL}/unsubscribe?${query(profileId)}`;
/** The one-click address mail apps call (List-Unsubscribe-Post). */
export const unsubscribeApiUrl = (profileId: string) => `${SITE_URL}/api/unsubscribe?${query(profileId)}`;
