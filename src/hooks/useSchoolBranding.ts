"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SchoolBranding = {
  name: string;
  nameArabic: string | null;
  logoUrl: string;
  /** True once a real school's own branding has loaded, false while showing
   *  the platform default (demo mode, signed out, or a school that hasn't
   *  set anything up yet). */
  isCustom: boolean;
};

const PLATFORM_DEFAULT: SchoolBranding = {
  name: "MyDiiwaan",
  nameArabic: "ديواني",
  logoUrl: "/crest.jpg",
  isCustom: false,
};

// Every school on the platform shares one deployment, so the crest and
// wordmark in the chrome have to come from whichever school the signed-in
// user belongs to rather than being baked into the markup. RLS already
// scopes `schools` to the caller's own row, so no filter is needed here.
export function useSchoolBranding(): SchoolBranding {
  const [branding, setBranding] = useState<SchoolBranding>(PLATFORM_DEFAULT);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("schools")
        .select("name, name_arabic, logo_url")
        .single();
      if (!data?.name) return;

      setBranding({
        name: data.name,
        nameArabic: data.name_arabic || null,
        logoUrl: data.logo_url || PLATFORM_DEFAULT.logoUrl,
        isCustom: true,
      });
    };

    load();
  }, []);

  return branding;
}
