import { ChevronRight } from "lucide-react";
import { APP_NAME } from "../../config/appConfig";

const PageHeader = ({ title, subtitle, actions = null, statusCount }) => (
  <header className="mb-5 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 backdrop-blur-xl md:px-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200">{APP_NAME}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
          {statusCount !== undefined ? <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs text-cyan-100">{statusCount}</span> : null}
        </div>
        <nav className="mt-1 flex items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
          <span>Dashboard</span><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{title}</span>
        </nav>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  </header>
);

export default PageHeader;
