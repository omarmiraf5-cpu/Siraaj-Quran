/*
 * The app's shared motion. Springs settle quickly and barely overshoot, so
 * things feel alive without bouncing about; every user of these also checks
 * useReducedMotion() and drops the movement for people who've asked for less.
 */

/** cubic-bezier for CSS-style eases: a fast start and a soft landing. */
export const SPRING_EASE = [0.16, 1, 0.3, 1] as const;

/** A button pressed. */
export const tapSpring = { type: "spring" as const, stiffness: 520, damping: 30 };

/** A marker sliding to its new place: the sidebar bar, a selected tab. */
export const pillSpring = { type: "spring" as const, stiffness: 380, damping: 30 };

/** Something arriving: a toast. */
export const enterSpring = { type: "spring" as const, bounce: 0.2, duration: 0.4 };
