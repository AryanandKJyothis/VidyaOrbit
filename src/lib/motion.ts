import type { Transition } from "framer-motion";

/**
 * Apple-style springs (WWDC “Designing Fluid Interfaces”), mapped to
 * Motion’s bounce + duration API.
 *
 * damping 1.0 → bounce 0 (critically damped, no overshoot)
 * damping ~0.8 → bounce ~0.2 (only after a flick / throw)
 * response 0.3–0.4s → duration 0.3–0.4 (settle time, not a fixed clip)
 */

/** Default UI: move / reposition. Critically damped, response 0.4s. */
export const springDefault: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.4,
};

/** Snappier press / chrome. Critically damped, response 0.3s. */
export const springSnappy: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.3,
};

/**
 * Drawer / sheet after a flick. Slight bounce only because the gesture
 * carried momentum — never use this for a menu that merely faded in.
 */
export const springMomentum: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.3,
};

/** Reduced-motion fallback: short opacity cross-fade, no travel. */
export const fadeOnly: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.23, 1, 0.32, 1],
};

/** Strong ease-out for CSS-style tweens (Emil / animate tables). */
export const easeOutStrong = [0.23, 1, 0.32, 1] as const;
export const easeInOutStrong = [0.77, 0, 0.175, 1] as const;
export const easeDrawer = [0.32, 0.72, 0, 1] as const;

/** List / section stagger delay between items (30–80ms). */
export const staggerMs = 48;

export function motionTransition(reduceMotion: boolean): Transition {
  return reduceMotion ? fadeOnly : springDefault;
}

export function snappyTransition(reduceMotion: boolean): Transition {
  return reduceMotion ? fadeOnly : springSnappy;
}

/**
 * Apple’s projection (not v²/2a). Used to pick a snap target from
 * release velocity so a flick lands where the gesture is going.
 */
export function project(
  initialVelocity: number,
  decelerationRate = 0.998,
): number {
  return (initialVelocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/**
 * Progressive resistance past a bound. A hard stop reads as frozen;
 * rubber-banding reads as “responsive, but nothing more here.”
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55,
): number {
  if (dimension <= 0) return 0;
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

export const pressScale = 0.97;
