"use client";

import { useMemo, useState } from "react";
import type { RecitationLogEntry } from "@/data/demo";
import { DAILY_RATING_LABELS, DAILY_RATING_ORDER } from "@/data/demo";
import { progressStats, RATING_COLOUR, type Period } from "@/lib/progressStats";
import { useSchoolRhythm } from "@/hooks/useSchoolRhythm";
import { useLanguage } from "@/components/LanguageProvider";
import { StatTile } from "@/components/portal-ui";

/**
 * A child's Qur'an progress at a glance, for the child and their parents:
 * how this month is going, quality and amount week by week, the surahs
 * recited so far and how each last went. Drawn from the graded sessions.
 */
export function ProgressCharts({ entries, today, name }: { entries: RecitationLogEntry[]; today: string; name: string }) {
  const { tr, language } = useLanguage();
  // Weekly, or monthly for a school that meets at weekends — until someone picks.
  const auto = useSchoolRhythm();
  const [chosen, setChosen] = useState<Period | null>(null);
  const period: Period = chosen ?? auto;
  const st = useMemo(() => progressStats(entries, today, period, language), [entries, today, period, language]);
  const first = name.split(" ")[0];

  if (st.total === 0) {
    return <p className="text-sm text-ink-muted py-3">{tr("No sessions graded yet. Progress appears here once the teacher has heard {name} recite.", { name: first })}</p>;
  }

  const maxSessions = Math.max(1, ...st.weeks.map((w) => w.counts.excellent + w.counts.very_good + w.counts.good + w.counts.weak + w.counts.not_recited));
  const maxAyahs = Math.max(1, ...st.weeks.map((w) => w.ayahs));
  const W = 560;
  const H = 150;
  const pad = { l: 30, r: 8, t: 10, b: 24 };
  const cw = (W - pad.l - pad.r) / st.weeks.length;
  const bw = Math.min(34, cw * 0.62);
  const y = (v: number, max: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const trendText =
    st.trend === "up" ? (period === "month" ? tr("Getting stronger — recent months are better than before.") : tr("Getting stronger — recent weeks are better than before."))
    : st.trend === "down" ? tr("A little more practice at home would help.")
    : st.trend === "steady" ? tr("Steady — keep it going.")
    : tr("Keep reciting — a trend appears after a few weeks.");

  return (
    <div className="space-y-5">
      <div role="group" aria-label={tr("Show by")} className="inline-flex rounded-full border border-surface-border bg-surface-card p-0.5 text-[12.5px] font-semibold">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setChosen(p)}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${period === p ? "bg-brand-navy text-white" : "text-ink-muted hover:text-ink"}`}
          >
            {p === "week" ? tr("Weekly") : tr("Monthly")}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={st.sessionsThisMonth} label={tr("Sessions this month")} sub={tr("{days} days of practice", { days: st.daysPracticedThisMonth })} />
        <StatTile value={st.ayahsThisMonth} label={tr("Ayahs this month")} sub={tr("recited and graded")} />
        <StatTile value={st.quality === null ? "—" : `${st.quality.toFixed(1)}/4`} label={tr("Average quality")} sub={tr("all sessions")} />
        <StatTile value={st.weeksInARow} label={period === "month" ? tr("Months in a row") : tr("Weeks in a row")} sub={tr("with a session")} />
      </div>
      <p className="text-[13.5px] font-semibold text-ink">{trendText}</p>

      <div>
        <p className="eyebrow mb-2">{period === "month" ? tr("How each month went") : tr("How each week went")}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={period === "month" ? tr("Sessions each month, coloured by rating") : tr("Sessions each week, coloured by rating")} className="w-full h-auto">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(maxSessions * f, maxSessions)} y2={y(maxSessions * f, maxSessions)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={pad.l - 6} y={y(maxSessions * f, maxSessions) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.55}>{Math.round(maxSessions * f)}</text>
            </g>
          ))}
          {st.weeks.map((w, i) => {
            const x = pad.l + i * cw + (cw - bw) / 2;
            let acc = 0;
            return (
              <g key={w.start}>
                {(["excellent", "very_good", "good", "weak", "not_recited"] as const).map((r) => {
                  const n = w.counts[r];
                  if (!n) return null;
                  const y1 = y(acc + n, maxSessions);
                  const h = y(acc, maxSessions) - y1;
                  acc += n;
                  return <rect key={r} x={x} y={y1} width={bw} height={h} rx={3} fill={RATING_COLOUR[r]} />;
                })}
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>{w.label}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {DAILY_RATING_ORDER.map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: RATING_COLOUR[r] }} />
              {tr(DAILY_RATING_LABELS[r])}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">{period === "month" ? tr("Ayahs recited each month") : tr("Ayahs recited each week")}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={period === "month" ? tr("Ayahs recited each month") : tr("Ayahs recited each week")} className="w-full h-auto">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(maxAyahs * f, maxAyahs)} y2={y(maxAyahs * f, maxAyahs)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={pad.l - 6} y={y(maxAyahs * f, maxAyahs) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.55}>{Math.round(maxAyahs * f)}</text>
            </g>
          ))}
          <polyline
            fill="none"
            stroke="#15305f"
            strokeWidth={2.5}
            strokeLinejoin="round"
            points={st.weeks.map((w, i) => `${pad.l + i * cw + cw / 2},${y(w.ayahs, maxAyahs)}`).join(" ")}
          />
          {st.weeks.map((w, i) => (
            <g key={w.start}>
              <circle cx={pad.l + i * cw + cw / 2} cy={y(w.ayahs, maxAyahs)} r={4} fill="#c9a24a" stroke="#15305f" strokeWidth={1.5} />
              <text x={pad.l + i * cw + cw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>{w.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div>
        <p className="eyebrow mb-2">
          {tr("{count} surah recited so far|{count} surahs recited so far", { count: st.surahs.length })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {st.surahs.map((s) => (
            <span
              key={s.id}
              title={`${tr(DAILY_RATING_LABELS[s.last])} · ${s.times}×`}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold"
              style={{ borderColor: `color-mix(in srgb, ${RATING_COLOUR[s.last]} 45%, transparent)`, color: RATING_COLOUR[s.last], background: `color-mix(in srgb, ${RATING_COLOUR[s.last]} 8%, transparent)` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: RATING_COLOUR[s.last] }} />
              {s.name}
            </span>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-muted mt-2">{tr("The colour is how that surah last went.")}</p>
      </div>
    </div>
  );
}
