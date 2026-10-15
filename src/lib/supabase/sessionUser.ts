import type { createClient } from "@/lib/supabase/client";

type Db = ReturnType<typeof createClient>;

/**
 * Who is signed in on this device, from the session it already holds — no
 * round trip to the auth server. For deciding what to load: every row that
 * comes back is still checked by the database's own access rules, so a
 * stale or forged session gets nothing it shouldn't.
 */
export async function sessionUser(supabase: Db) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

type Verified = Awaited<ReturnType<Db["auth"]["getUser"]>>;
let verified: { at: number; result: Promise<Verified> } | null = null;

let listening = false;

/**
 * The signed-in account as the auth server confirms it — the check that
 * notices a login revoked elsewhere. Asked once and shared: the sign-in
 * guard, the forced password change and the saved language each used to
 * ask on every page, one round trip apiece.
 */
export function verifiedUser(supabase: Db): Promise<Verified> {
  // Signing in or out, or a changed password, and the next check asks afresh.
  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") verified = null;
    });
  }
  if (!verified || Date.now() - verified.at > 30_000) {
    const result = supabase.auth.getUser();
    verified = { at: Date.now(), result };
    // A failed check isn't kept: the next caller asks again.
    result.then(
      (r) => {
        if (r.error && verified?.result === result) verified = null;
      },
      () => {
        if (verified?.result === result) verified = null;
      }
    );
  }
  return verified.result;
}

/** After signing in or out, the next check must ask afresh. */
export function forgetVerifiedUser() {
  verified = null;
}
