"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { useLanguage } from "@/components/LanguageProvider";

/** A parent turning the Friday progress emails off or on again, for themselves. */
export function WeeklyEmailsSwitch() {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await sessionUser(supabase);
      if (!user) return;
      setUserId(user.id);
      // Before update 12 there's no such setting: the switch stays hidden.
      const { data, error: loadError } = await supabase.from("profiles").select("weekly_reports_off_at").eq("id", user.id).maybeSingle();
      if (!loadError) setOn(!data?.weekly_reports_off_at);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (on === null || !userId) return null;
  const flip = async () => {
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ weekly_reports_off_at: on ? new Date().toISOString() : null })
      .eq("id", userId);
    setBusy(false);
    if (saveError) setError(tr("That didn't save. Please try again."));
    else setOn(!on);
  };
  return (
    <section className="card-quiet p-5 flex items-center justify-between gap-4" data-section="weekly-emails">
      <div>
        <p className="text-[14px] font-semibold text-ink">{tr("Friday progress emails")}</p>
        <p className="text-[12.5px] text-ink-muted">{on ? tr("You get an email each Friday about your child's week.") : tr("Off — you won't get the Friday emails.")}</p>
        {error && <p className="text-[12px] text-red-700 dark:text-red-300 mt-1">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={tr("Friday progress emails")}
        onClick={flip}
        disabled={busy}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${on ? "bg-emerald-700" : "bg-surface-border"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </section>
  );
}
