"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SHOW_DEMO_LOGINS } from "@/lib/demoMode";

/**
 * Nobody signed in on this device: off to the sign-in page, and back here
 * after. The pages show the sample school when no one is signed in, which
 * is only ever meant for the showcase deployment's sample logins — on a
 * real school's site, a login that has run out would otherwise land on
 * made-up children instead of the sign-in screen.
 */
export function useSignInGuard() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let sampling = false;
    try {
      sampling = SHOW_DEMO_LOGINS && !!localStorage.getItem("demo_user");
    } catch {
      /* private mode */
    }
    if (sampling) return;
    let cancelled = false;
    const supabase = createClient();
    const toSignIn = () => router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return;
        if (!session) return toSignIn();
        // A login Supabase refuses — run out for good, or signed out
        // elsewhere — is no login at all. (A blip just keeps the one here.)
        const { data, error } = await supabase.auth.getUser();
        const status = (error as { status?: number } | null)?.status;
        if (!cancelled && !data.user && (status === 401 || status === 403)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          toSignIn();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);
}
