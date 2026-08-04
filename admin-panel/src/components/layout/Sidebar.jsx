import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Ambulance,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CarFront,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Construction,
  FileArchive,
  Flame,
  GraduationCap,
  HardHat,
  HeartPulse,
  Leaf,
  ListChecks,
  PackageCheck,
  Route,
  Settings,
  ShieldAlert,
  Siren,
  Trash2,
  Users,
  Wrench,
  X
} from "lucide-react";
import { APP_NAME } from "../../config/appConfig";
import { NAV_GROUPS } from "../../config/enterpriseHseConfig";
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
  settings: Settings,
  incidents: AlertTriangle,
  observations: ClipboardList,
  capa: ListChecks,
  permits: ShieldAlert,
  inspections: ClipboardCheck,
  "toolbox-talks": HardHat,
  ppe: PackageCheck,
  contractors: Building2,
  "emergency-logs": Siren,
  documents: FileArchive,
  "vehicle-inspections": CarFront,
  "road-conditions": Route,
  "toll-incidents": Construction,
  "fire-inspections": Flame,
  "first-aid": Ambulance,
  "equipment-inspections": Wrench,
  "environmental-observations": Leaf,
  "waste-records": Trash2,
  "compliance-calendar": CalendarClock,
  "competency-matrix": BookOpenCheck
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
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((module) => canAccessModule(user, module.key))
  })).filter((group) => group.items.length);
  const compact = collapsed && !mobile;
  const activeGroupKey = groups.find((group) => group.items.some((item) => item.key === activeModule))?.key;
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(["overview", activeGroupKey].filter(Boolean)));

  useEffect(() => {
    if (!activeGroupKey) return;
    setExpandedGroups((previous) => new Set([...previous, activeGroupKey]));
  }, [activeGroupKey]);

  const toggleGroup = (key) => setExpandedGroups((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

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

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Application modules">
        {groups.map((group, groupIndex) => {
          const expanded = compact || expandedGroups.has(group.key);
          return (
            <section key={group.key} aria-label={group.label}>
              {!compact ? (
                <button type="button" onClick={() => toggleGroup(group.key)} className="flex min-h-9 w-full items-center justify-between rounded-xl px-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-white/5 hover:text-slate-300" aria-expanded={expanded}>
                  <span>{group.label}</span><ChevronDown size={13} className={`transition ${expanded ? "rotate-180" : ""}`} />
                </button>
              ) : null}
              {expanded ? <div className="mt-1 space-y-1.5">{group.items.map((module, itemIndex) => {
                const Icon = icons[module.icon || module.key] || ChartNoAxesCombined;
                const active = activeModule === module.key;
                return (
                  <motion.button key={module.key} type="button" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.015 * (groupIndex + itemIndex) }} onClick={() => onSelectModule(module.key)} className={classNames("group relative flex w-full items-center rounded-xl text-left transition", compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5", active ? "brand-nav-active text-white" : "bg-white/[0.035] text-slate-300 hover:bg-white/10 hover:text-white")} title={compact ? module.label : undefined} aria-current={active ? "page" : undefined}>
                    <Icon size={16} className="shrink-0" />
                    {!compact ? <span className="truncate text-xs font-medium">{module.label}</span> : null}
                    {!compact && active ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" /> : null}
                    {compact ? <span className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-slate-900/95 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur-xl transition group-hover:opacity-100">{module.label}</span> : null}
                  </motion.button>
                );
              })}</div> : null}
            </section>
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
