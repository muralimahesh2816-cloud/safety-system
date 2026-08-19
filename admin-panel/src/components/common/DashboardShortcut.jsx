import { LayoutDashboard } from "lucide-react";
import { goToDashboard } from "../../utils/navigation";

/**
 * One-click "back to Dashboard" control, reused everywhere instead of
 * every page inventing its own back-navigation button. Text label hides
 * on narrow screens so it never causes topbar/header overflow — see
 * PageHeader.jsx, the single place this is wired in for every module
 * that shares that header (Training, Hazards, Work Approvals, Reports,
 * Users, Settings, System Health, Enterprise HSE).
 */
const DashboardShortcut = ({ className = "" }) => (
  <button
    type="button"
    onClick={goToDashboard}
    className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/15 hover:text-white ${className}`}
    aria-label="Back to Dashboard"
  >
    <LayoutDashboard size={14} aria-hidden="true" />
    <span className="hidden sm:inline">Dashboard</span>
  </button>
);

export default DashboardShortcut;
