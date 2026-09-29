"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Signs out an account the school office has switched off, and takes it to
 * the sign-in page, which says why. Checked as each portal page opens: the
 * database already gives a switched-off account nothing, so without this a
 * session opened before the switch would sit on empty pages until it ran
 * out. Nothing happens in the sample portal, where nobody is signed in.
 */
export function useSwitchedOffGuard() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        const id = session?.user?.id;
        if (!id) return;
        const { data } = await supabase.from("profiles").select("active").eq("id", id).maybeSingle();
        if (cancelled || data?.active !== false) return;
        await supabase.auth.signOut().catch(() => {});
        router.replace("/login?off=1");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);
}
