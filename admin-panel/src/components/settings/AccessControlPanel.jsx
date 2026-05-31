import { useEffect, useMemo, useState } from "react";
import GlassCard from "../common/GlassCard";
import { userService } from "../../api/services";
import { showSuccessPopup } from "../../utils/alerts";
import { normalizePermissions, toPermissionPayload } from "../../utils/permissions";

const permissionColumns = [
  { key: "dashboard", label: "Dashboard" },
  { key: "work", label: "Work" },
  { key: "hazard", label: "Hazard" },
  { key: "training", label: "Training" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" }
];

const AccessControlPanel = ({ currentUser, onPermissionUpdated = () => {} }) => {
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const canManage = useMemo(
    () => ["super_admin", "admin"].includes(currentUser?.role),
    [currentUser?.role]
  );

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await userService.list();
      const list = response.users || [];
      setUsers(list);
      const normalizedDrafts = list.reduce((acc, user) => {
        acc[user._id] = normalizePermissions(user.permissions, user.role);
        return acc;
      }, {});
      setDrafts(normalizedDrafts);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load access control users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onToggle = (userId, key, checked) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [key]: checked
      }
    }));
  };

  const savePermissions = async (user) => {
    if (!canManage) {
      setError("Only Admin or Super Admin can update permissions");
      return;
    }

    const payload = toPermissionPayload(drafts[user._id] || {});
    setSavingId(user._id);
    setError("");
    try {
      const response = await userService.updatePermissions(user._id, payload);
      await showSuccessPopup("Permissions Saved Successfully");
      const updatedUser = response.user || { ...user, permissions: payload };
      setUsers((prev) =>
        prev.map((item) =>
          item._id === user._id
            ? {
                ...item,
                ...updatedUser,
                permissions: normalizePermissions(updatedUser.permissions, updatedUser.role || item.role)
              }
            : item
        )
      );
      onPermissionUpdated(updatedUser);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || "Permission update failed");
    } finally {
      setSavingId("");
    }
  };

  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Access Control</h3>
        <button
          type="button"
          onClick={fetchUsers}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-slate-200"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="text-sm text-slate-300">Loading users...</p> : null}
      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
      {!loading ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-300">
                <th className="py-2 pr-3">User Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                {permissionColumns.map((column) => (
                  <th key={column.key} className="py-2 pr-3 text-center">
                    {column.label}
                  </th>
                ))}
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const rowPermissions = drafts[user._id] || normalizePermissions(user.permissions, user.role);
                const readOnly = user.role === "super_admin";
                return (
                  <tr key={user._id} className="border-b border-white/5 text-slate-200">
                    <td className="py-2 pr-3 font-medium text-white">{user.name}</td>
                    <td className="py-2 pr-3">{user.email}</td>
                    <td className="py-2 pr-3 capitalize">{(user.role || "-").replace("_", " ")}</td>
                    {permissionColumns.map((column) => (
                      <td key={`${user._id}-${column.key}`} className="py-2 pr-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(rowPermissions[column.key])}
                          onChange={(event) => onToggle(user._id, column.key, event.target.checked)}
                          disabled={!canManage || readOnly}
                          className="h-4 w-4 accent-teal-400"
                        />
                      </td>
                    ))}
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => savePermissions(user)}
                        disabled={!canManage || readOnly || savingId === user._id}
                        className="rounded-lg border border-teal-400/40 bg-teal-500/20 px-2.5 py-1 text-[11px] text-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingId === user._id ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={permissionColumns.length + 4} className="py-3 text-center text-slate-300">
                    No users available
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </GlassCard>
  );
};

export default AccessControlPanel;

