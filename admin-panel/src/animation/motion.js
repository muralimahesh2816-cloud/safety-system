// Single source of truth for motion across the portal.
//
// Rules this file encodes, so individual pages never have to re-decide them:
//   * Only `transform` and `opacity` are animated — never width/height/top/left
//     or margin — so every transition stays on the compositor.
//   * Durations sit in the 140-320ms band. Enterprise UI should feel immediate,
//     not theatrical.
//   * Everything degrades to an instant, non-animated state when the user has
//     `prefers-reduced-motion: reduce` set (see `useReducedMotion` below and
//     the global CSS guard in styles/theme/theme.scss).

export const DURATION = Object.freeze({
  instant: 0.12,
  fast: 0.16,
  base: 0.22,
  slow: 0.32
});

export const EASE = Object.freeze({
  out: [0.22, 0.75, 0.25, 1],
  inOut: [0.6, 0.05, 0.3, 0.95]
});

/** Whole-page transition used by the module switcher in App.js. */
export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: DURATION.base, ease: EASE.out }
};

/** Card mount. `delay` is applied by the caller for list stagger. */
export const cardEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.slow, ease: EASE.out }
};

/**
 * Subtle elevation lift. Deliberately no rotation and no scale above 1.01 —
 * heavy 3D card tilts read as a toy, and they force a repaint of every
 * translucent surface stacked under them.
 */
export const cardHover = {
  whileHover: { y: -3 },
  whileTap: { y: -1 },
  transition: { duration: DURATION.fast, ease: EASE.out }
};

export const modalEnter = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.99 },
  transition: { duration: DURATION.base, ease: EASE.out }
};

export const overlayEnter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast }
};

export const buttonPress = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.985 },
  transition: { duration: DURATION.instant, ease: EASE.out }
};

/** Parent/child pair for staggered list reveals. */
export const listEnter = {
  container: {
    animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } }
  },
  item: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } }
  }
};

export const sidebarExpand = {
  transition: { duration: DURATION.base, ease: EASE.out }
};

export const notificationEnter = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: DURATION.fast, ease: EASE.out }
};

/** Success checkmark pop used by submission feedback. */
export const successPop = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: { type: "spring", stiffness: 420, damping: 26 }
};

/** Error shake — one short lateral nudge, never a loop. */
export const errorShake = {
  initial: { opacity: 0, x: 0 },
  animate: { opacity: 1, x: [0, -5, 5, -3, 0] },
  transition: { duration: DURATION.slow, ease: EASE.out }
};

/**
 * Strips animation out of any variant set above. Pass the value of
 * `useReducedMotion()`; when true the element renders straight to its final
 * state with no transition at all.
 */
export const withReducedMotion = (variants, reduced) => {
  if (!reduced) return variants;
  const { animate } = variants;
  return { initial: false, animate, transition: { duration: 0 } };
};
