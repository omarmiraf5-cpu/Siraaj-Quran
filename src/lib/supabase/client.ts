import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Fall back to harmless placeholders when Supabase isn't configured yet.
// createBrowserClient throws synchronously on empty/undefined values, and
// these pages are statically prerendered at build time — an unconfigured
// deployment must still be able to build (and run in demo mode) rather
// than crashing `next build`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const steadied = new WeakSet<object>();

/**
 * Every page asks auth.getUser() who is signed in, and takes "nobody" to
 * mean the sample school. But that question goes to Supabase, and a blip —
 * a dropped connection, a login being renewed at that moment — answers
 * "nobody" for someone who is signed in, who then sees sample data. So
 * when this device holds a login and the answer was a failure rather than
 * a refusal, it's asked once more, then the login on the device is
 * trusted: the database still checks it on every request it makes.
 */
function steady(client: SupabaseClient): SupabaseClient {
  if (steadied.has(client)) return client;
  steadied.add(client);
  const ask = client.auth.getUser.bind(client.auth);
  const refused = (error: unknown) => [401, 403].includes((error as { status?: number } | null)?.status ?? 0);
  client.auth.getUser = (async (jwt?: string) => {
    const first = await ask(jwt);
    if (first.data.user || jwt || refused(first.error)) return first;
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.user) return first;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const second = await ask();
    if (second.data.user || refused(second.error)) return second;
    return { data: { user: session.user }, error: null };
  }) as typeof client.auth.getUser;
  return client;
}

export function createClient() {
  return steady(createBrowserClient(supabaseUrl, supabaseAnonKey));
}
