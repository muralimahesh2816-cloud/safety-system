import { motion } from "framer-motion";
import { DURATION, EASE } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import { classNames } from "../../utils/format";

/**
 * The pre-existing panel surface, kept for compatibility with every page that
 * already uses it. Two changes, both for frame cost:
 *
 *  - `backdrop-blur-2xl` is gone. A page routinely stacks 6-10 of these over
 *    an animated background; each one made the compositor re-blur its whole
 *    footprint on every scroll frame. The panel now paints an opaque-enough
 *    brand surface instead, which is visually equivalent at this opacity.
 *  - hover no longer scales the card (scaling a large translucent box forces a
 *    full repaint of its subtree); it lifts and brightens the border instead.
 *
 * Genuine glassmorphism is still available where it earns its cost — the login
 * card and `EnterpriseCard tone="glass"`.
 */
const GlassCard = ({ children, className = "", hover = true, delay = 0 }) => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE.out, delay }}
      whileHover={hover && !reduced ? { y: -3 } : undefined}
      className={classNames(
        "brand-glass-card rounded-3xl border border-white/12 bg-slate-950/55 shadow-[0_16px_46px_rgba(2,6,23,0.32)] transition-colors duration-200",
        hover ? "hover:border-white/20" : "",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
