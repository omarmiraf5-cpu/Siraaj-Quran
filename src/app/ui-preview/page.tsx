"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatDistance } from "@/lib/attendanceRules";
import {
  ActionLink,
  DangerButton,
  MotionList,
  MotionRow,
  PageFade,
  Segmented,
  SkeletonRows,
  SkeletonStats,
  SpotlightButton,
  StatusBadge,
  useToast,
} from "@/components/motion-ui";

const RADII = [100, 150, 250, 500];

export default function UiPreviewPage() {
  const { t, tr } = useLanguage();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [radius, setRadius] = useState(150);
  const [nav, setNav] = useState("teachers");
  const links = [
    { id: "home", label: t("nav.dashboard") },
    { id: "teachers", label: t("nav.teachers") },
    { id: "settings", label: tr("Sign-in settings") },
  ];
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);

  const rows = [
    { name: "Amina Hassan", plan: "Starter", status: tr("Active") },
    { name: "Omar Warsame", plan: "Starter", status: tr("Active") },
    { name: "Safia Abdi", plan: "Starter", status: tr("Inactive") },
  ];

  return (
    <PageFade>
      <div className="min-h-screen bg-surface-bg text-ink">
        <header className="gradient-navy px-5 py-8">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">{tr("Platform")}</p>
          <h1 className="font-display text-3xl font-bold text-white mt-1">MyDiiwaan</h1>
        </header>
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
          <section className="card-quiet card-lift p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <SpotlightButton
                loading={loading}
                onClick={() => {
                  setLoading(true);
                  window.setTimeout(() => {
                    setLoading(false);
                    toast.success(tr("Done"));
                  }, 700);
                }}
              >
                {loading ? tr("Saving…") : tr("Save settings")}
              </SpotlightButton>
              <SpotlightButton variant="light" onClick={() => toast.error(tr("That didn't save. Please try again."))}>
                {tr("Use my current location")}
              </SpotlightButton>
            </div>
            <div>
              <p className="eyebrow mb-2">{tr("How close counts as on the premises")}</p>
              <Segmented
                label={tr("How close counts as on the premises")}
                value={radius}
                onChange={setRadius}
                options={RADII.map((r) => ({ value: r, label: formatDistance(r) }))}
              />
            </div>
            <label className="block max-w-sm">
              <span className="eyebrow block mb-1.5">{tr("Latitude")}</span>
              <input className="field-glow w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px]" defaultValue="53.546100" />
            </label>
          </section>

          <div className="grid md:grid-cols-[220px_1fr] gap-4">
            <nav className="card-quiet p-2 space-y-1" aria-label={tr("Teachers")}>
              {links.map((item) => {
                const on = nav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNav(item.id)}
                    className={`nav-link ${on ? "nav-link-on" : ""}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="preview-nav"
                        className="nav-pill"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <section className="card-quiet overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">{tr("All teachers")}</h2>
                <button type="button" className="text-[12px] font-semibold text-[#102A56]" onClick={() => setModal(true)}>
                  {tr("Change")}
                </button>
              </div>
              <MotionList className="divide-y divide-surface-border">
                {rows.map((row) => (
                  <MotionRow key={row.name} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-9 h-9 rounded-full bg-[#102A56]/10 text-[#102A56] text-[11px] font-bold flex items-center justify-center">
                      {row.name.slice(0, 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{row.name}</p>
                      <p className="text-[11px] text-ink-muted truncate">name@mydiiwaan.com</p>
                    </div>
                    <StatusBadge tip={tr("Plan")}>{row.plan}</StatusBadge>
                    <StatusBadge tip={row.status}>{row.status}</StatusBadge>
                    <ActionLink
                      onClick={() =>
                        toast.success(tr("Welcome email sent to {email}.", { email: "name@mydiiwaan.com" }) as string)
                      }
                    >
                      {tr("Send welcome email")}
                    </ActionLink>
                    <DangerButton onClick={() => toast.error(tr("That didn't save. Please try again."))}>
                      {tr("Delete")}
                    </DangerButton>
                  </MotionRow>
                ))}
              </MotionList>
            </section>
          </div>

          <SkeletonStats />
          <section className="card-quiet p-5">
            <SkeletonRows count={3} />
          </section>
        </div>

        {modal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label={tr("Cancel")} onClick={() => setModal(false)} />
            <div role="dialog" aria-modal="true" className="modal-elevate relative w-full max-w-sm card-quiet p-5 space-y-3">
              <h2 className="font-semibold">{tr("Sign-in settings")}</h2>
              <input className="field-glow w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px]" placeholder={tr("The school's address")} />
              <div className="flex justify-end gap-2">
                <SpotlightButton variant="light" onClick={() => setModal(false)}>
                  {tr("Cancel")}
                </SpotlightButton>
                <SpotlightButton
                  onClick={() => {
                    setModal(false);
                    toast.success(tr("Done"));
                  }}
                >
                  {tr("Save settings")}
                </SpotlightButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageFade>
  );
}
