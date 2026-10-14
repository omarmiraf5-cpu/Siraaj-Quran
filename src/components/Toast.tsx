"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { enterSpring } from "@/lib/motion-config";
import { useLanguage } from "@/components/LanguageProvider";

/*
 * A short confirmation that floats in and leaves on its own: "Attendance
 * saved", "3 students given to Ustadh Omar". Callers pass text already in
 * the reader's language (tr). On a phone it sits just under the top bar,
 * clear of the save bars and tab bar at the foot of the screen; on a larger
 * screen, in the bottom corner at the reading end. It slides in from the
 * side the language reads from.
 */

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; text: string };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Shows toasts; does nothing (rather than throwing) outside a provider. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}
const NOOP: ToastApi = { success: () => {}, error: () => {} };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reduce = useReducedMotion();
  const { dir } = useLanguage();

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3400);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t) }), [push]);
  const from = dir === "rtl" ? -16 : 16;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed z-[70] end-4 top-[calc(4.25rem+env(safe-area-inset-top))] md:top-auto md:bottom-6 md:end-6 flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduce}
              role={t.kind === "error" ? "alert" : "status"}
              initial={reduce ? false : { opacity: 0, x: from }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: from }}
              transition={reduce ? { duration: 0 } : enterSpring}
              className={`pointer-events-auto toast-card ${t.kind === "success" ? "toast-ok" : "toast-bad"}`}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <span aria-hidden className="toast-dot" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
