"use client";

import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Shared ease from the interaction spec. */
export const SPRING_EASE = [0.16, 1, 0.3, 1] as const;

const tapSpring = { type: "spring" as const, stiffness: 520, damping: 28 };
const enterSpring = { type: "spring" as const, bounce: 0.32, duration: 0.42 };

function Spinner() {
  return (
    <span
      className="spot-spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}

export function SpotlightButton({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
}: {
  variant?: "primary" | "light";
  loading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}) {
  const reduce = useReducedMotion();
  const [spot, setSpot] = useState({ x: 40, y: 20 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const off = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={off}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setSpot({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onClick={(e) => {
        if (!reduce) {
          const r = e.currentTarget.getBoundingClientRect();
          const id = Date.now() + Math.random();
          setRipples((prev) => [...prev.slice(-4), { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
          window.setTimeout(() => setRipples((prev) => prev.filter((p) => p.id !== id)), 650);
        }
        onClick?.(e);
      }}
      whileTap={reduce || off ? undefined : { scale: 0.97 }}
      transition={tapSpring}
      className={`spot-btn ${variant === "primary" ? "spot-primary" : "spot-light"} ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(140px circle at ${spot.x}px ${spot.y}px, ${
            variant === "primary" ? "rgba(255,255,255,0.24)" : "rgba(16,42,86,0.10)"
          }, transparent 62%)`,
        }}
      />
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-white/50"
          style={{ left: r.x, top: r.y, width: 10, height: 10, marginLeft: -5, marginTop: -5 }}
          initial={{ scale: 0.2, opacity: 0.65 }}
          animate={{ scale: 16, opacity: 0 }}
          transition={{ duration: 0.55, ease: SPRING_EASE }}
        />
      ))}
      <span className="relative inline-flex items-center gap-2">
        {loading && <Spinner />}
        {children}
      </span>
    </motion.button>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  const reduce = useReducedMotion();
  const group = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className={`segmented-opt ${on ? "segmented-on" : ""}`}
          >
            {on && (
              <motion.span
                layoutId={`segment-${group}`}
                className="segmented-pill"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 460, damping: 16, mass: 0.7 }
                }
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({ children, tip }: { children: ReactNode; tip: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span tabIndex={0} className="status-pill">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : enterSpring}
            className="status-tip"
          >
            {tip}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function ActionLink({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={reduce || disabled ? undefined : { x: 3 }}
      whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.28, ease: SPRING_EASE }}
      className="text-[12px] font-semibold text-[#102A56] underline-offset-2 hover:underline disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}

export function DangerButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={reduce || disabled ? undefined : { scale: 0.97, backgroundColor: "#b42318", color: "#ffffff" }}
      transition={tapSpring}
      className="danger-btn"
    >
      {children}
    </motion.button>
  );
}

const rowHidden = { opacity: 0, y: 10 };
const rowShown = { opacity: 1, y: 0 };

export function MotionList({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
      }}
    >
      {children}
    </motion.ul>
  );
}

export function MotionRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      className={`row-lift ${className}`}
      variants={{
        hidden: reduce ? rowShown : rowHidden,
        show: { ...rowShown, transition: { duration: reduce ? 0 : 0.4, ease: SPRING_EASE } },
      }}
      whileHover={reduce ? undefined : { y: -2, backgroundColor: "rgba(16,42,86,0.045)" }}
    >
      {children}
    </motion.li>
  );
}

/** Stagger a table body. Rows opt in with MotionTr. */
export function MotionBody({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.tbody
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.045 } } }}
      className="divide-y divide-surface-border"
    >
      {children}
    </motion.tbody>
  );
}

export function MotionTr({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.tr
      className={`row-lift ${className}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.38, delay: reduce ? 0 : index * 0.045, ease: SPRING_EASE }}
    >
      {children}
    </motion.tr>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card-quiet p-4 space-y-3">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-7 w-20" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-2.5 w-56 max-w-full" />
          </div>
          <div className="skeleton h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.38, ease: SPRING_EASE }}
    >
      {children}
    </motion.div>
  );
}

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; text: string };

const ToastContext = createContext<{
  success: (text: string) => void;
  error: (text: string) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reduce = useReducedMotion();

  const push = (kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3400);
  };

  return (
    <ToastContext.Provider value={{ success: (text) => push("success", text), error: (text) => push("error", text) }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 md:bottom-6 end-4 z-[80] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
              transition={reduce ? { duration: 0 } : enterSpring}
              className={`pointer-events-auto toast-card ${t.kind === "success" ? "toast-ok" : "toast-bad"}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
