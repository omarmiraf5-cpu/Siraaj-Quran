import { createBrowserClient } from "@supabase/ssr";

// Fall back to harmless placeholders when Supabase isn't configured yet.
// createBrowserClient throws synchronously on empty/undefined values, and
// these pages are statically prerendered at build time — an unconfigured
// deployment must still be able to build (and run in demo mode) rather
// than crashing `next build`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
