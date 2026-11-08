"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Period } from "@/lib/progressStats";

/**
 * How often this school meets: "month" for a weekend school (classes only on
 * Saturday and Sunday), where a chart by the week would be a few dots, and
 * "week" for everyone else. Read from the school's own calendar setting; the
 * demo and anyone not signed in get weeks.
 */
export function useSchoolRhythm(): Period {
  const [period, setPeriod] = useState<Period>("week");
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("schools")
      .select("instructional_weekdays")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const days = (data?.instructional_weekdays as number[] | null | undefined) ?? [];
        if (!cancelled && days.length > 0 && days.every((d) => d === 6 || d === 7)) setPeriod("month");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return period;
}
