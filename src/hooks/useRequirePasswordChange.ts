"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The login page already redirects here the moment a temporary password is
// used, but that only fires at the instant of signing in — an already-open
// tab, the back button, or a bookmark straight into a portal route would
// skip it. Called from each portal layout as a backstop so the flag is
// still honoured no matter how someone arrives.
export function useRequirePasswordChange() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.must_change_password) {
        router.replace("/change-password");
      }
    });
  }, [router]);
}
