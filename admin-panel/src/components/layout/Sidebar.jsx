import { motion } from "framer-motion";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Flame,
  GraduationCap,
  HeartPulse,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldAlert,
  Users
} from "lucide-react";
import { NAV_MODULES } from "../../config/appConfig";
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
  collapsed = false
}) => {
  const modules = NAV_MODULES.filter((module) => canAccessModule(user, module.key));
  const compact = collapsed && !mobile;

  return (
    <aside
      className={classNames(
        "flex h-full w-full flex-col border-r border-white/10 bg-slate-950/80 p-4 backdrop-blur-2xl",
        mobile ? "border-r-0" : ""
      )}
    >
      <div className={classNames("mb-4 flex", compact ? "justify-center" : "justify-start")}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-xl border border-white/15 bg-white/10 p-2 text-white"
          aria-label={compact ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {compact ? <Menu size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      <nav className="space-y-2">
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
                  ? "bg-gradient-to-r from-teal-500/40 to-sky-500/40 text-white"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={compact ? module.label : undefined}
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
    </aside>
  );
};

export default Sidebar;
