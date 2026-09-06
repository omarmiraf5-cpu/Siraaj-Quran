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
