"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SHOW_DEMO_LOGINS } from "@/lib/demoMode";
import { homeOf, mayOpen } from "@/lib/portalAccess";

/**
 * Nobody signed in on this device: off to the sign-in page, and back here
 * after. The pages show the sample school when no one is signed in, which
 * is only ever meant for the showcase deployment's sample logins — on a
 * real school's site, a login that has run out would otherwise land on
 * made-up children instead of the sign-in screen.
 *
 * And someone signed in to a portal that isn't theirs — a student's login
 * on a teacher's or a parent's pages — is sent to their own. Until that's
 * settled the page reports `blocked`, so the wrong portal's screens never
 * show.
 */
export function useSignInGuard(): { blocked: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const [blocked, setBlocked] = useState(false);
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
          return;
        }
        // Whose portal this is. The role is read from the database, never
        // from anything the device could change.
        const id = data.user?.id ?? session.user.id;
        const { data: me, error: meError } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
        if (cancelled || meError) return;
        if (!mayOpen(pathname, me?.role)) {
          setBlocked(true);
          router.replace(homeOf(me?.role));
        } else setBlocked(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);
  return { blocked };
}
