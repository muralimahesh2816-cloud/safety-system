import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DURATION, EASE } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import SafetyIconCard from "./SafetyIconCard";

/**
 * Count-up for a KPI value.
 *
 * Two things matter here because the dashboard renders ~28 of these at once:
 *  - it only animates when the number actually changed from what is on screen,
 *    so the 30s dashboard refresh doesn't restart 28 rAF loops for values that
 *    did not move;
 *  - it writes to the DOM node directly instead of calling setState per frame.
 *    28 components x 60fps of React re-renders was the single largest source of
 *    main-thread work on this page.
 */
const AnimatedNumber = ({ value }) => {
  const nodeRef = useRef(null);
  const displayedRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    const target = Math.max(0, Number(value || 0));
    const from = displayedRef.current;

    const settle = () => {
      displayedRef.current = target;
      node.textContent = target.toLocaleString();
    };

    // Correctness before decoration. `requestAnimationFrame` does not run in a
    // background tab and is throttled under load, so anything that *only*
    // reaches its final value at the end of an animation can leave a KPI
    // reading 0 when the real figure is not 0 — on a safety dashboard that is
    // a wrong number, not a missing animation.
    if (reduced || from === target || typeof document === "undefined" || document.hidden) {
      settle();
      return undefined;
    }

    const startedAt = performance.now();
    let frame = null;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 650);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(from + (target - from) * eased);
      node.textContent = current.toLocaleString();
      displayedRef.current = current;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else settle();
    };
    frame = requestAnimationFrame(tick);

    // Backstop: if frames stop arriving (tab hidden mid-animation, heavy main
    // thread), the value still lands on the truth.
    const backstop = setTimeout(settle, 1200);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(backstop);
    };
  }, [value, reduced]);

  return <span ref={nodeRef}>0</span>;
};

/**
 * Dashboard KPI tile.
 *
 * No `backdrop-filter` and no 3D transform: with this many tiles stacked over
 * the animated portal background, each translucent blur layer forced the
 * compositor to re-rasterise the region behind it on every scroll frame. The
 * gradient + a flat scrim gives the same visual weight for free.
 */
const KPIBox = ({
  title,
  value,
  icon: Icon,
  backgroundIcon: BackgroundIcon = Icon,
  gradient,
  accent,
  delay = 0,
  hint
}) => {
  const reduced = useReducedMotion();

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE.out, delay }}
      whileHover={reduced ? undefined : { y: -4 }}
      className={`kpi-tile group relative min-h-36 overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br ${gradient} p-5 shadow-[0_16px_44px_rgba(2,6,23,.28)]`}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/30" />
      <BackgroundIcon
        className={`pointer-events-none absolute -bottom-6 -right-4 h-28 w-28 ${accent} opacity-[0.08] transition-transform duration-500 group-hover:scale-105`}
        strokeWidth={1}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">{title}</p>
          <p className="mt-3 font-display text-4xl font-bold leading-none text-white">
            <AnimatedNumber value={value} />
          </p>
          {hint ? <p className="mt-2 text-xs text-slate-300">{hint}</p> : null}
        </div>
        <SafetyIconCard icon={Icon} accent={accent} />
      </div>
    </motion.article>
  );
};

export default KPIBox;
