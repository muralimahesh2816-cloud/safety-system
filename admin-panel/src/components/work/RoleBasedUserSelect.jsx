import { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { userService } from "../../api/services";
import { ROLE_LABELS } from "../../constants/roles";

const getId = (user) => String(user?._id || user?.id || "");
const roleLabel = (role = "") => ROLE_LABELS[role] || String(role || "").replace(/_/g, " ");

const RoleBasedUserSelect = ({
  stage,
  value = "",
  onChange,
  label = "Assign User",
  excludeUserId = "",
  excludeUserIds = [],
  required = false,
  disabled = false,
  compact = false
}) => {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const excludedIdsKey = useMemo(
    () => [...new Set([excludeUserId, ...excludeUserIds].filter(Boolean).map(String))].sort().join(","),
    [excludeUserId, excludeUserIds]
  );

  useEffect(() => {
    if (!stage || disabled) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const results = await userService.eligibleAssignees(stage, {
          search: search.trim() || undefined,
          excludeUserIds: excludedIdsKey || undefined
        });
        if (requestRef.current === requestId) setUsers(results);
      } catch (fetchError) {
        if (requestRef.current === requestId) {
          setUsers([]);
          setError(fetchError?.response?.data?.message || "Unable to load eligible users");
        }
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [disabled, excludedIdsKey, search, stage]);

  const selected = useMemo(() => users.find((item) => getId(item) === String(value)), [users, value]);

  return (
    <div className={compact ? "space-y-2" : "rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3"}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
          {label}{required ? " *" : ""}
        </span>
        <span className="relative block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder="Search name or employee ID"
            className="w-full rounded-xl border border-white/12 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none disabled:opacity-50"
          />
        </span>
      </label>
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        required={required}
        disabled={disabled || loading}
        aria-label={label}
        className="w-full rounded-xl border border-white/12 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-cyan-300/60 focus:outline-none disabled:opacity-50"
      >
        <option value="" className="bg-slate-900 text-white">
          {loading ? "Loading eligible users..." : "Select an eligible user"}
        </option>
        {users.map((item) => (
          <option key={getId(item)} value={getId(item)} className="bg-slate-900 text-white">
            {item.name} | {item.employeeId || "No employee ID"} | {roleLabel(item.role)}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-500/[0.06] px-3 py-2 text-xs text-slate-200">
          <UserRound size={14} className="text-emerald-300" />
          <span>{selected.name} - {roleLabel(selected.role)}</span>
        </div>
      ) : null}
      {!loading && !error && users.length === 0 ? (
        <p className="text-xs text-amber-200">No active eligible users found.</p>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
};

export default RoleBasedUserSelect;
