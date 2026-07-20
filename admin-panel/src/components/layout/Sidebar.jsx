import { motion } from "framer-motion";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Flame,
  GraduationCap,
  HeartPulse,
  Settings,
  ShieldAlert,
  Users,
  X
} from "lucide-react";
import { APP_NAME, NAV_MODULES } from "../../config/appConfig";
import vertisLogo from "../../assets/vertis-logo.svg";
import { classNames } from "../../utils/format";
import { canAccessModule } from "../../utils/permissions";

const icons = {
  dashboard: ChartNoAxesCombined,
  work: ClipboardCheck,
  hazards: ShieldAlert,
  training: GraduationCap,
  users: Users,
  reports: Flame,
  health: HeartPulse,
  settings: Settings
};

const Sidebar = ({
  activeModule,
  onSelectModule,
  onToggleCollapse,
  mobile = false,
  user,
  collapsed = false,
  locked = false,
  onLockChange
}) => {
  const modules = NAV_MODULES.filter((module) => canAccessModule(user, module.key));
  const compact = collapsed && !mobile;

  return (
    <aside
      aria-label="Primary navigation"
      className={classNames(
        "brand-sidebar flex h-full w-full flex-col border-r border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl",
        mobile ? "border-r-0" : ""
      )}
    >
      <div className={classNames("mb-4 flex items-center", compact ? "justify-center" : "justify-between gap-3")}>
        <div className={classNames("flex min-w-0 items-center", compact ? "justify-center" : "gap-2")} title={compact ? APP_NAME : undefined}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1"><img src={vertisLogo} alt="Vertis" className="h-full w-full object-contain" /></span>
          {!compact ? <span className="text-sm font-semibold leading-tight text-white">{APP_NAME}</span> : null}
        </div>
        {mobile ? (
          <button type="button" onClick={onToggleCollapse} className="rounded-xl border border-white/15 bg-white/10 p-2 text-white" aria-label="Close navigation menu">
            <X size={16} />
          </button>
        ) : null}
      </div>

      <nav className="space-y-2" aria-label="Application modules">
        {modules.map((module, index) => {
          const Icon = icons[module.key] || ChartNoAxesCombined;
          const active = activeModule === module.key;
          return (
            <motion.button
              key={module.key}
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * index }}
              onClick={() => onSelectModule(module.key)}
              className={classNames(
                "group relative flex w-full items-center rounded-2xl text-left transition",
                compact ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                active
                  ? "brand-nav-active text-white"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={compact ? module.label : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} />
              {!compact ? <span className="text-sm font-medium">{module.label}</span> : null}
              {!compact && active ? (
                <span className="ml-auto h-2 w-2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
              ) : null}
              {compact ? (
                <span className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-lg border border-white/20 bg-slate-900/95 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur-xl transition group-hover:opacity-100">
                  {module.label}
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </nav>
      {!compact && !mobile ? (
        <label className="mt-auto flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => onLockChange?.(event.target.checked)}
            aria-label="Keep sidebar expanded"
            className="brand-lock-input h-4 w-4"
          />
          <span>
            <span className="block font-semibold">Keep sidebar expanded</span>
            <span className="mt-0.5 block text-[10px] text-slate-400">{locked ? "Pinned" : "Auto-expand on hover"}</span>
          </span>
        </label>
      ) : null}
    </aside>
  );
};

export default Sidebar;
