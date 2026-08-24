import { useMemo, useState } from "react";
import { Check, Info, Minus, ShieldCheck, Users } from "lucide-react";
import EnterpriseCard from "../common/EnterpriseCard";
import { ROLE_LABELS, ROLES } from "../../constants/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "../../utils/permissions";

/**
 * What each role can do, by default.
 *
 * Every cell is derived — from `DEFAULT_ROLE_PERMISSIONS` (the same table
 * `normalizePermissions` applies when a user has no explicit override) and from
 * the workflow/attendance authority constants below, which mirror the server's
 * own role lists. Nothing here is a hand-written approximation of the policy,
 * because a hard-coded matrix would drift from the rules actually enforced and
 * would then be worse than no matrix at all.
 *
 * It is deliberately read-only. Role defaults live in code on both sides, so an
 * editable role grid would either not persist or would need a second,
 * competing permission system — which the brief explicitly rules out. The
 * per-user override editor beside it is the mechanism that does persist and
 * that the backend enforces.
 */

// Mirrors STAGE_ROLE_FALLBACKS in backend/src/routes/work.routes.js.
const WORKFLOW_AUTHORITY = {
  check: [
    ROLES.SAFETY_OFFICER,
    ROLES.SAFETY_ENGINEER,
    ROLES.SITE_ENGINEER,
    ROLES.PROJECT_ENGINEER,
    ROLES.MAINTENANCE_ENGINEER
  ],
  recommend: [ROLES.SAFETY_MANAGER],
  approve: [ROLES.MAINTENANCE_MANAGER, ROLES.PROJECT_MANAGER]
};

// Mirrors ATTENDANCE_SCANNER_ROLES / ATTENDANCE_REMOVER_ROLES in
// backend/src/constants/work-attendance.js.
const ATTENDANCE_SCANNERS = [
  ROLES.SAFETY_OFFICER,
  ROLES.SAFETY_ENGINEER,
  ROLES.SITE_ENGINEER,
  ROLES.PROJECT_ENGINEER,
  ROLES.MAINTENANCE_ENGINEER,
  ROLES.CONSTRUCTION_MANAGER,
  ROLES.OPERATIONS_MANAGER,
  ROLES.SAFETY_MANAGER,
  ROLES.PROJECT_MANAGER,
  ROLES.MAINTENANCE_MANAGER,
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
];

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

const has = (list, role) => list.includes(role);
const modulePermission = (role, key) => Boolean(DEFAULT_ROLE_PERMISSIONS[role]?.[key]);

// Each row states how it is decided, so a reader can trace a cell back to the
// rule that produces it.
const PERMISSION_ROWS = [
  { label: "View Dashboard", resolve: (role) => modulePermission(role, "dashboard") },
  { label: "Work Approvals", resolve: (role) => modulePermission(role, "work") },
  { label: "Create Hazard", resolve: (role) => modulePermission(role, "hazard") },
  { label: "Training", resolve: (role) => modulePermission(role, "training") },
  { label: "Reports", resolve: (role) => modulePermission(role, "reports") },
  { label: "Check Work", resolve: (role) => has(WORKFLOW_AUTHORITY.check, role) || has(ADMIN_ROLES, role) },
  { label: "Recommend Work", resolve: (role) => has(WORKFLOW_AUTHORITY.recommend, role) || has(ADMIN_ROLES, role) },
  { label: "Final Approve", resolve: (role) => has(WORKFLOW_AUTHORITY.approve, role) || has(ADMIN_ROLES, role) },
  { label: "Scan Attendance", resolve: (role) => has(ATTENDANCE_SCANNERS, role) },
  {
    label: "Remove Attendance",
    resolve: (role) => [ROLES.SAFETY_MANAGER, ...ADMIN_ROLES].includes(role)
  },
  { label: "User Management", resolve: (role) => modulePermission(role, "users") },
  { label: "Settings", resolve: (role) => modulePermission(role, "settings") }
];

const Cell = ({ allowed }) => (
  <td className="px-2.5 py-2 text-center">
    {allowed ? (
      <>
        <Check size={14} className="mx-auto text-emerald-300" aria-hidden="true" />
        <span className="sr-only">Allowed</span>
      </>
    ) : (
      <>
        <Minus size={14} className="mx-auto text-slate-600" aria-hidden="true" />
        <span className="sr-only">Not allowed</span>
      </>
    )}
  </td>
);

const RolePermissionMatrix = ({ users = [] }) => {
  const [showAllRoles, setShowAllRoles] = useState(false);

  // Roles that actually exist in this deployment come first; the rest are
  // available behind a toggle so the default view is not 16 columns wide.
  const memberCounts = useMemo(() => {
    const counts = new Map();
    users.forEach((user) => counts.set(user.role, (counts.get(user.role) || 0) + 1));
    return counts;
  }, [users]);

  const roles = useMemo(() => {
    const all = Object.values(ROLES);
    const inUse = all.filter((role) => memberCounts.get(role));
    if (showAllRoles || inUse.length === 0) return all;
    // Always include the administrative roles so the matrix is meaningful even
    // on a deployment where none are currently assigned.
    return Array.from(new Set([...inUse, ...ADMIN_ROLES]));
  }, [memberCounts, showAllRoles]);

  return (
    <EnterpriseCard
      title="Role Permission Matrix"
      subtitle="What each role can do by default. Derived from the permission rules the server enforces — not a separate list."
      icon={ShieldCheck}
      action={
        <button
          type="button"
          onClick={() => setShowAllRoles((value) => !value)}
          className="inline-flex min-h-9 items-center rounded-xl border border-white/15 bg-white/[0.07] px-3 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.13]"
        >
          {showAllRoles ? "Roles in use" : "All roles"}
        </button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-xs">
          <caption className="sr-only">
            Default permissions granted to each role
          </caption>
          <thead className="bg-white/[0.05] text-[10px] uppercase tracking-[0.08em] text-slate-400">
            <tr>
              <th scope="col" className="sticky left-0 bg-[#15171a] px-3 py-2.5 font-semibold">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role} scope="col" className="px-2.5 py-2.5 text-center font-semibold">
                  <span className="block whitespace-nowrap">{ROLE_LABELS[role] || role}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-normal normal-case text-slate-500">
                    <Users size={9} aria-hidden="true" />
                    {memberCounts.get(role) || 0}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-white/[0.07]">
                <th
                  scope="row"
                  className="sticky left-0 bg-[#15171a] px-3 py-2 text-left font-medium text-slate-200"
                >
                  {row.label}
                </th>
                {roles.map((role) => (
                  <Cell key={role} allowed={row.resolve(role)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          These are role <strong className="font-semibold text-slate-300">defaults</strong>. An
          individual user can be granted or denied module access below, which overrides the default
          for that person. Every permission is re-checked on the server for each request — nothing
          here is enforced by the browser alone.
        </span>
      </p>
    </EnterpriseCard>
  );
};

export default RolePermissionMatrix;
