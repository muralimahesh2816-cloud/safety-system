import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cardEnter, cardHover, DURATION, EASE } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import { classNames } from "../../utils/format";
import { CardSkeleton } from "./Skeletons";

/**
 * The standard surface for every major panel in the portal.
 *
 * Deliberately *not* glassmorphic by default: a translucent card with
 * `backdrop-filter` forces the compositor to re-blur everything stacked behind
 * it on each frame, and a dashboard carries dozens of these. Glass is reserved
 * for the login card and a small number of premium surfaces via `tone="glass"`.
 *
 * Supports title / subtitle / icon / kpi / action / hover / loading / empty
 * so pages stop hand-rolling their own header rows.
 */
const toneStyles = {
  default: "border-white/10 bg-slate-950/55",
  raised: "border-white/12 bg-white/[0.05]",
  glass: "border-white/15 bg-white/[0.07] backdrop-blur-xl",
  success: "border-emerald-400/25 bg-emerald-500/[0.07]",
  warning: "border-amber-400/25 bg-amber-500/[0.07]",
  critical: "border-rose-400/25 bg-rose-500/[0.07]",
  info: "border-sky-400/25 bg-sky-500/[0.07]"
};

const EnterpriseCard = forwardRef(function EnterpriseCard(
  {
    title,
    subtitle,
    icon: Icon,
    kpi,
    kpiHint,
    action,
    footer,
    tone = "default",
    hover = false,
    loading = false,
    empty = null,
    delay = 0,
    className = "",
    bodyClassName = "",
    children,
    ...rest
  },
  ref
) {
  const reduced = useReducedMotion();
  const hasHeader = Boolean(title || subtitle || Icon || action);

  const motionProps = reduced
    ? {}
    : {
        ...cardEnter,
        transition: { ...cardEnter.transition, delay },
        ...(hover ? { whileHover: cardHover.whileHover } : {})
      };

  if (loading) {
    return <CardSkeleton className={className} />;
  }

  return (
    <motion.section
      ref={ref}
      {...motionProps}
      transition={
        reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE.out, delay }
      }
      className={classNames(
        "enterprise-card relative overflow-hidden rounded-3xl border shadow-[0_14px_40px_rgba(2,6,23,0.28)]",
        toneStyles[tone] || toneStyles.default,
        hover ? "enterprise-card--interactive" : "",
        className
      )}
      {...rest}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[var(--brand-accent-soft,#f0a69b)]">
                <Icon size={17} aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h3 className="truncate text-sm font-semibold text-white">{title}</h3> : null}
              {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      {kpi !== undefined && kpi !== null ? (
        <div className="px-5 pt-4">
          <p className="font-display text-3xl font-semibold leading-none text-white">{kpi}</p>
          {kpiHint ? <p className="mt-1.5 text-xs text-slate-400">{kpiHint}</p> : null}
        </div>
      ) : null}

      <div className={classNames("px-5 py-4", bodyClassName)}>{empty || children}</div>

      {footer ? (
        <footer className="border-t border-white/8 px-5 py-3 text-xs text-slate-400">{footer}</footer>
      ) : null}
    </motion.section>
  );
});

export default EnterpriseCard;
