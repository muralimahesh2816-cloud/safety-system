import { ChevronRight } from "lucide-react";
import { APP_NAME } from "../../config/appConfig";
import { goToDashboard } from "../../utils/navigation";
import DashboardShortcut from "./DashboardShortcut";

// `trail` lets a page add intermediate breadcrumb segments between
// Dashboard and the page title, e.g. ["Training"] renders
// "Dashboard / Training / <title>". Optional — every existing PageHeader
// caller keeps working unchanged with just "Dashboard / <title>".
const PageHeader = ({ title, subtitle, actions = null, statusCount, trail = [] }) => (
  <header className="brand-page-header mb-5 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 backdrop-blur-xl md:px-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="brand-page-kicker text-[10px] font-semibold uppercase tracking-[0.18em]">{APP_NAME}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
          {statusCount !== undefined ? <span className="brand-status-count rounded-full px-2 py-1 text-xs">{statusCount}</span> : null}
        </div>
        <nav className="mt-1 flex items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
          <button type="button" onClick={goToDashboard} className="rounded text-slate-400 underline-offset-2 hover:text-white hover:underline">
            Dashboard
          </button>
          {trail.map((crumb) => (
            <span key={crumb} className="flex items-center gap-1">
              <ChevronRight size={12} aria-hidden="true" />
              <span>{crumb}</span>
            </span>
          ))}
          <ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{title}</span>
        </nav>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <DashboardShortcut />
      </div>
    </div>
  </header>
);

export default PageHeader;
