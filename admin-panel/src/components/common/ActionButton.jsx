import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { buttonPress, successPop } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import { classNames } from "../../utils/format";
import { ButtonSpinner } from "./Skeletons";

/**
 * One button component for every consequential action (Submit, Approve,
 * Check, Recommend, Complete, Generate Certificate, Upload, Delete...).
 *
 * It owns the four states the spec requires, so no page has to re-implement
 * them and no page can forget one:
 *   idle | loading ("Submitting..." + spinner, pointer events off)
 *        | success (animated check, auto-reverts via the caller's state)
 *        | error   (warning icon + retry affordance)
 *
 * `loading` also sets `disabled`, which is what actually prevents the
 * double-submit — the click handler can never fire twice from the UI. Pages
 * additionally hold a ref-based lock for the in-flight window between the
 * click and the first React commit.
 */
const variants = {
  primary: "hse-primary-button text-white",
  secondary: "border border-white/15 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14]",
  ghost: "border border-transparent text-slate-300 hover:bg-white/[0.08] hover:text-white",
  danger: "border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
  success: "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
};

const sizes = {
  sm: "min-h-9 px-3 text-[11px]",
  md: "min-h-11 px-4 text-xs",
  lg: "min-h-12 px-5 text-sm"
};

const ActionButton = forwardRef(function ActionButton(
  {
    children,
    icon: Icon,
    loading = false,
    loadingLabel = "Submitting...",
    success = false,
    successLabel = "Done",
    error = false,
    errorLabel,
    variant = "primary",
    size = "md",
    disabled = false,
    className = "",
    type = "button",
    ...rest
  },
  ref
) {
  const reduced = useReducedMotion();
  const isBusy = loading;
  const isDisabled = disabled || isBusy;

  const state = isBusy ? "loading" : success ? "success" : error ? "error" : "idle";
  const label =
    state === "loading"
      ? loadingLabel
      : state === "success"
      ? successLabel
      : state === "error"
      ? errorLabel || children
      : children;

  const motionProps = reduced ? {} : buttonPress;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isBusy || undefined}
      aria-live={state === "loading" ? "polite" : undefined}
      data-state={state}
      className={classNames(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[state === "error" ? "danger" : state === "success" ? "success" : variant] ||
          variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...motionProps}
      {...rest}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "loading" ? (
          <motion.span key="spinner" {...(reduced ? {} : successPop)} className="inline-flex">
            <ButtonSpinner size={size === "sm" ? 12 : 14} />
          </motion.span>
        ) : state === "success" ? (
          <motion.span key="check" {...(reduced ? {} : successPop)} className="inline-flex">
            <Check size={size === "sm" ? 13 : 15} aria-hidden="true" />
          </motion.span>
        ) : state === "error" ? (
          <motion.span key="error" {...(reduced ? {} : successPop)} className="inline-flex">
            <AlertTriangle size={size === "sm" ? 13 : 15} aria-hidden="true" />
          </motion.span>
        ) : Icon ? (
          <motion.span key="icon" className="inline-flex">
            <Icon size={size === "sm" ? 13 : 15} aria-hidden="true" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <span className="truncate">{label}</span>
    </motion.button>
  );
});

export default ActionButton;
