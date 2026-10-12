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
  /** Whether logoUrl is the school's own logo rather than the MyDiiwaan
   *  crest standing in for one. A school can have its name in the chrome
   *  without having uploaded a logo, and the crest is drawn differently
   *  from a school's own artwork (see SidebarNav's Crest). */
  hasOwnLogo: boolean;
};

const PLATFORM_DEFAULT: SchoolBranding = {
  name: "MyDiiwaan",
  nameArabic: "ديواني",
  logoUrl: "/crest.jpg",
  isCustom: false,
  hasOwnLogo: false,
};

// Every school on the platform shares one deployment, so the crest and
// wordmark in the chrome have to come from whichever school the signed-in
// user belongs to rather than being baked into the markup.
export function useSchoolBranding(): SchoolBranding {
  const [branding, setBranding] = useState<SchoolBranding>(PLATFORM_DEFAULT);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Their school by its id: someone who can see more than one school
      // (an admin, with a teacher who works at another too) otherwise got
      // no answer here, and the chrome kept the platform's name.
      const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      if (!me?.school_id) return;
      const { data } = await supabase
        .from("schools")
        .select("name, name_arabic, logo_url")
        .eq("id", me.school_id)
        .maybeSingle();
      if (!data?.name) return;

      setBranding({
        name: data.name,
        nameArabic: data.name_arabic || null,
        logoUrl: data.logo_url || PLATFORM_DEFAULT.logoUrl,
        isCustom: true,
        hasOwnLogo: Boolean(data.logo_url),
      });
    };

    load();
  }, []);

  return branding;
}
