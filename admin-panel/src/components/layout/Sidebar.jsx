import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  Flame,
  GraduationCap,
  HardHat,
  HeartPulse,
  LogOut,
  Pin,
  PinOff,
  Settings,
  ShieldAlert,
  Siren,
  Users,
  X
} from "lucide-react";
import { APP_NAME } from "../../config/appConfig";
import { NAV_GROUPS } from "../../config/enterpriseHseConfig";
import vertisLogo from "../../assets/vertis-logo.svg";
import { classNames } from "../../utils/format";
import { canAccessModule } from "../../utils/permissions";
import useReducedMotion from "../../hooks/useReducedMotion";

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
  permits: ShieldAlert,
  inspections: ClipboardCheck,
  "toolbox-talks": HardHat,
  "emergency-logs": Siren,
  "compliance-calendar": CalendarClock
};

/**
 * Primary navigation.
 *
 * Animation approach, per the redesign brief:
 *
 *  - **Icons never move.** The icon sits in a fixed-width column with the same
 *    left offset in both the collapsed rail and the expanded panel, so
 *    expanding reveals the label rather than sliding the whole row. The old
 *    behaviour centred icons when collapsed and left-aligned them when
 *    expanded, which made every icon jump on hover.
 *  - **Labels fade and slide**, they do not mount and unmount. They stay in the
 *    DOM (clipped when collapsed) so expanding is a repaint, not a re-render of
 *    the whole nav — and so the accessible name is identical in both states.
 *  - **The active indicator is a single shared element** that slides between
 *    items via framer-motion's `layoutId`. Because it is a shared-layout
 *    element it renders in the correct place even when the animation cannot
 *    run (background tab, reduced motion), so it can never end up stranded.
 */
const Sidebar = ({
  activeModule,
  onSelectModule,
  onToggleCollapse,
  onLogout,
  mobile = false,
  user,
  collapsed = false,
  locked = false,
  onLockChange
}) => {
  const reduced = useReducedMotion();
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

  const toggleGroup = (key) =>
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <aside
      aria-label="Primary navigation"
      data-collapsed={compact ? "true" : "false"}
      className={classNames("brand-sidebar", mobile ? "brand-sidebar--mobile" : "")}
    >
      {/* ------------------------------------------------------- brand */}
      <div className="brand-sidebar__head">
        <span className="brand-sidebar__logo">
          <img src={vertisLogo} alt="" aria-hidden="true" />
        </span>
        <span className="brand-sidebar__wordmark">{APP_NAME}</span>
        {mobile ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="brand-sidebar__close"
            aria-label="Close navigation menu"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* -------------------------------------------------------- nav */}
      <nav className="brand-sidebar__nav" aria-label="Application modules">
        {groups.map((group) => {
          const expanded = compact || expandedGroups.has(group.key);
          return (
            <section key={group.key} aria-label={group.label} className="brand-sidebar__group">
              {!compact ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="brand-sidebar__group-toggle"
                  aria-expanded={expanded}
                >
                  <span>{group.label}</span>
                  <ChevronDown size={13} className={expanded ? "rotate-180" : ""} aria-hidden="true" />
                </button>
              ) : null}

              {expanded ? (
                <div className="brand-sidebar__items">
                  {group.items.map((module) => {
                    const Icon = icons[module.icon || module.key] || ChartNoAxesCombined;
                    const active = activeModule === module.key;
                    return (
                      <button
                        key={module.key}
                        type="button"
                        onClick={() => onSelectModule(module.key)}
                        className={classNames("brand-nav-item", active ? "brand-nav-item--active" : "")}
                        // Explicit, so the collapsed rail (where the label is
                        // clipped) reports the same name as the expanded panel.
                        aria-label={module.label}
                        aria-current={active ? "page" : undefined}
                      >
                        {active ? (
                          <motion.span
                            layoutId={mobile ? undefined : "brand-nav-indicator"}
                            className="brand-nav-item__indicator"
                            transition={
                              reduced
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 520, damping: 40 }
                            }
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="brand-nav-item__icon">
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <span className="brand-nav-item__label">{module.label}</span>
                        {/* Visual affordance for the rail only — the label above
                            is already the accessible name. */}
                        <span aria-hidden="true" className="brand-nav-item__tooltip">
                          {module.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      {/* ----------------------------------------------------- footer */}
      <div className="brand-sidebar__footer">
        {!mobile ? (
          <button
            type="button"
            onClick={() => onLockChange?.(!locked)}
            className="brand-sidebar__pin"
            aria-pressed={locked}
            aria-label={locked ? "Unpin sidebar" : "Keep sidebar expanded"}
          >
            <span className="brand-nav-item__icon">
              {locked ? <Pin size={16} aria-hidden="true" /> : <PinOff size={16} aria-hidden="true" />}
            </span>
            <span className="brand-nav-item__label">{locked ? "Sidebar pinned" : "Pin sidebar"}</span>
            <span aria-hidden="true" className="brand-nav-item__tooltip">
              {locked ? "Unpin sidebar" : "Keep sidebar expanded"}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onLogout}
          className="brand-nav-item brand-nav-item--logout"
          aria-label="Logout"
        >
          <span className="brand-nav-item__icon">
            <LogOut size={17} aria-hidden="true" />
          </span>
          <span className="brand-nav-item__label">Logout</span>
          <span aria-hidden="true" className="brand-nav-item__tooltip">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
