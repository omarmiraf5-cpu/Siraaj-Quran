import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses the service-role key, which bypasses row-level security entirely —
// this must never be imported from a Client Component or exposed to the
// browser. Only for privileged operations (like creating a staff account)
// that a normal, RLS-scoped user session cannot perform on its own.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Whose login this email and password are, or null: for a server route that
 * needs someone to show an account is theirs without being signed in to it.
 * It signs in once, in a session of its own that is closed again straight
 * away; the person's other sessions, on their phone or anywhere else, are
 * left alone.
 */
export async function passwordUser(email: string, password: string): Promise<string | null> {
  if (!email || !password) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  await client.auth.signOut({ scope: "local" }).catch(() => {});
  return data.user.id;
}
