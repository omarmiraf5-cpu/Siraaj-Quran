/** Shared motion. Spring easing is cubic-bezier(0.16, 1, 0.3, 1). */

export const SPRING_EASE = [0.16, 1, 0.3, 1] as const;

export const tapSpring = { type: "spring" as const, stiffness: 520, damping: 28 };

export const pillSpring = { type: "spring" as const, stiffness: 380, damping: 28 };

export const enterSpring = { type: "spring" as const, bounce: 0.28, duration: 0.4 };

export const hoverSpring = { type: "spring" as const, stiffness: 420, damping: 16 };
