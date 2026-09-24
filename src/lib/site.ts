/**
 * Contact details shown on the privacy, support and account pages, and in
 * the app store listings. One place, so changing the address changes it
 * everywhere.
 */
export const SUPPORT_EMAIL = "omar.miraf5@gmail.com";
/**
 * Canonical origin. The bare host (https://mydiiwaan.com) 308-redirects here
 * at the edge (Cloudflare CNAME to Vercel). Email links, metadata and store
 * listings should use this origin. Supabase Auth → URL Configuration must
 * use the same Site URL; that setting lives in the Supabase dashboard, not
 * in this repo. See docs/app-store-release.md.
 */
export const SITE_URL = "https://www.mydiiwaan.com";
export const PRIVACY_UPDATED = "24 September 2026";

/**
 * Where the "a new school just signed up" email goes. Never shown on the
 * site. Until a domain is verified with Resend, this has to be the address
 * the Resend account was opened with: it's the only one Resend's shared
 * test sender delivers to.
 */
export const NEW_SCHOOL_ALERT_EMAIL = "omar.miraf5@gmail.com";
