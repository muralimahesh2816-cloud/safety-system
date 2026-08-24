import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, Lock, Search, Shield, Unlock } from "lucide-react";
import GlassCard from "../components/common/GlassCard";
import ImageStudioModal from "../components/common/ImageStudioModal";
import WorkerQrCard from "../components/attendance/WorkerQrCard";
import PageHeader from "../components/common/PageHeader";
import { userService } from "../api/services";
import { ROLE_GROUPS, ROLE_LABELS, ROLES } from "../constants/roles";
import { closeLoadingPopup, showLoadingPopup, showSuccessPopup, showValidationPopup } from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import { resolveAssetUrl } from "../utils/media";
import { ENTERPRISE_HSE_KEYS, getEnterpriseModule } from "../config/enterpriseHseConfig";

const initialForm = {
  name: "",
  email: "",
  mobile: "",
  employeeId: "",
  department: "",
  role: "",
  password: ""
};

const modulePermissionRows = [
  "dashboard",
  "users",
  "work",
  "hazards",
  "training",
  "reports",
  "settings",
  "notifications",
  ...ENTERPRISE_HSE_KEYS
];

const UsersPage = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [imageModal, setImageModal] = useState({ open: false, items: [], index: 0, compare: null });
  const [savingUser, setSavingUser] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "", status: "", page: 1 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const submitLockRef = useRef(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await userService.list({
        page: filters.page,
        limit: 10,
        search: filters.search.trim() || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined
      });
      setUsers(response.users || []);
      setPagination(response.pagination || { page: filters.page, totalPages: 1, total: response.users?.length || 0 });
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.role, filters.search, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(fetchUsers, 250);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  const canManageUsers = useMemo(
    () => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUser?.role),
    [currentUser?.role]
  );

  // Mirrors the backend role check on POST /users/:id/worker-qr/regenerate.
  const canRegenerateWorkerQr = useMemo(
    () => [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER].includes(currentUser?.role),
    [currentUser?.role]
  );

  const getUserPhoto = (userRecord) =>
    resolveAssetUrl(
      userRecord?.profilePhoto?.url ||
        userRecord?.profilePhoto?.path ||
        userRecord?.profilePhoto?.filename ||
        userRecord?.profilePhoto ||
        userRecord?.profileImage ||
        userRecord?.photo ||
        userRecord?.photoUrl ||
        userRecord?.avatar
    );

  const resetForm = () => {
    setForm(initialForm);
    setEditId("");
    setPhotoFile(null);
  };

  const startEdit = (user) => {
    if (!canManageUsers) return;
    setEditId(user._id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      employeeId: user.employeeId || "",
      department: user.department || "",
      role: user.role || "",
      password: ""
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canManageUsers) {
      setError("Only admin roles can manage user records");
      return;
    }
    if (!form.name || !form.email || !form.mobile || !form.role || (!editId && !form.password)) {
      setError("Fill all user fields");
      showValidationPopup("Please fill all required User fields.");
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSavingUser(true);
    setError("");
    await showLoadingPopup("Uploading Please Wait...", editId ? "Updating user details..." : "Creating user...");
    try {
      if (editId) {
        await userService.update(editId, {
          name: form.name,
          email: form.email,
          mobile: form.mobile,
          employeeId: form.employeeId,
          department: form.department,
          role: form.role
        });
        if (photoFile) {
          await userService.uploadProfilePhoto(editId, photoFile);
        }
        await showSuccessPopup("User Updated Successfully");
      } else {
        const created = await userService.create(form);
        if (photoFile && created?.user?.id) {
          await userService.uploadProfilePhoto(created.user.id, photoFile);
        }
        await showSuccessPopup("User Created Successfully");
      }
      resetForm();
      fetchUsers();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Unable to save user");
    } finally {
      submitLockRef.current = false;
      setSavingUser(false);
      closeLoadingPopup();
    }
  };

  const deleteUser = async (id) => {
    if (!canManageUsers) {
      setError("Only admin roles can delete users");
      return;
    }
    if (!window.confirm("Delete this user?")) return;
    try {
      await userService.remove(id);
      await showSuccessPopup("User Deleted Successfully");
      fetchUsers();
    } catch (removeError) {
      setError(removeError?.response?.data?.message || "Delete failed");
    }
  };

  const resetPassword = async (id) => {
    if (!canManageUsers) {
      setError("Only admin roles can reset passwords");
      return;
    }
    const newPassword = window.prompt("Enter new password (min 8 chars)", "TempPass@123");
    if (!newPassword) return;
    try {
      await userService.resetPassword(id, newPassword);
      await showSuccessPopup("Password Reset Successfully");
    } catch (passwordError) {
      setError(passwordError?.response?.data?.message || "Password reset failed");
    }
  };

  const toggleBlock = async (user) => {
    if (!canManageUsers) {
      setError("Only admin roles can block or activate users");
      return;
    }
    try {
      if (user.status === "blocked") await userService.activate(user._id);
      else await userService.block(user._id);
      await showSuccessPopup(
        user.status === "blocked" ? "User Activated Successfully" : "User Blocked Successfully"
      );
      fetchUsers();
    } catch (statusError) {
      setError(statusError?.response?.data?.message || "Status update failed");
    }
  };

  const openHistory = async (user) => {
    setSelectedUser(user);
    try {
      const response = await userService.loginHistory(user._id);
      setHistory(response.history || []);
    } catch (_error) {
      setHistory([]);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Administration"
        subtitle="Create, update, block, activate, reset credentials, and audit login behavior"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="p-5 xl:col-span-1">
          <h3 className="mb-3 text-lg font-semibold text-white">
            {editId ? "Edit User" : "Create User"}
          </h3>
          <form className="space-y-3" onSubmit={submit}>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Full name"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
              disabled={!canManageUsers}
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
              disabled={!canManageUsers}
            />
            <input
              value={form.mobile}
              onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
              placeholder="Mobile"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              disabled={!canManageUsers}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.employeeId}
                onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
                placeholder="Employee ID"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                disabled={!canManageUsers}
              />
              <input
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                placeholder="Department"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                disabled={!canManageUsers}
              />
            </div>
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              disabled={!canManageUsers}
            >
              <option value="" className="bg-slate-900 text-white">
                Select Role
              </option>
              {ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label} className="bg-slate-900 text-white">
                  {group.roles.map((value) => (
                    <option key={value} value={value} className="bg-slate-900 text-white">
                      {ROLE_LABELS[value] || value}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {!editId ? (
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Password"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                required
                disabled={!canManageUsers}
              />
            ) : null}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
              disabled={!canManageUsers}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl hse-primary-button px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canManageUsers || savingUser}
              >
                {savingUser ? "Uploading..." : editId ? "Update User" : "Create User"}
              </button>
              {editId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </GlassCard>

        <GlassCard className="p-5 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Users</h3>
              <p className="text-xs text-slate-400">{pagination.total || 0} matching user records</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto">
              <label className="relative block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
                  placeholder="Search users"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500"
                />
              </label>
              <select
                value={filters.role}
                onChange={(event) => setFilters((previous) => ({ ...previous, role: event.target.value, page: 1 }))}
                className="rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 text-xs text-white"
              >
                <option value="">All roles</option>
                {ROLE_GROUPS.flatMap((group) => group.roles).map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
                className="rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 text-xs text-white"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="hidden h-[532px] overflow-auto rounded-2xl border border-white/10 md:block">
            <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-slate-300 backdrop-blur-xl">
                <tr className="h-14 border-b border-white/10">
                  <th className="w-[180px] px-3">Name</th>
                  <th className="w-[105px] px-3">Employee ID</th>
                  <th className="w-[140px] px-3">Role</th>
                  <th className="w-[120px] px-3">Department</th>
                  <th className="w-[190px] px-3">Email</th>
                  <th className="w-[85px] px-3">Status</th>
                  <th className="w-[145px] px-3">Last Login</th>
                  <th className="w-[210px] px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-300">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-300">No users found.</td></tr>
                ) : users.map((user) => {
                  const photoUrl = getUserPhoto(user);
                  return (
                    <tr key={user._id} className="h-[68px] border-b border-white/[0.07] text-slate-200 hover:bg-white/[0.035]">
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => photoUrl && setImageModal({ open: true, items: [{ url: photoUrl }], index: 0, compare: null })}
                            className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/10"
                          >
                            {photoUrl ? <img src={photoUrl} alt={user.name} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-semibold text-teal-200">{(user.name || "U").charAt(0)}</span>}
                          </button>
                          <span className="truncate font-semibold text-white">{user.name}</span>
                        </div>
                      </td>
                      <td className="truncate px-3">{user.employeeId || "-"}</td>
                      <td className="truncate px-3">{ROLE_LABELS[user.role] || user.role}</td>
                      <td className="truncate px-3">{user.department || "-"}</td>
                      <td className="truncate px-3">{user.email}</td>
                      <td className="px-3"><span className={`rounded-full px-2 py-1 ${user.status === "active" ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>{user.status}</span></td>
                      <td className="px-3 text-slate-400">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</td>
                      <td className="px-3">
                        <div className="flex flex-wrap gap-1">
                          {canManageUsers ? <button type="button" onClick={() => startEdit(user)} className="rounded-lg border border-white/15 px-2 py-1 text-white">Edit</button> : null}
                          {canManageUsers ? <button type="button" onClick={() => resetPassword(user._id)} className="rounded-lg border border-amber-400/30 px-2 py-1 text-amber-100"><KeyRound size={11} /></button> : null}
                          {canManageUsers ? <button type="button" onClick={() => toggleBlock(user)} className="rounded-lg border border-sky-400/30 px-2 py-1 text-sky-100">{user.status === "blocked" ? <Unlock size={11} /> : <Lock size={11} />}</button> : null}
                          <button type="button" onClick={() => openHistory(user)} className="rounded-lg border border-teal-400/30 px-2 py-1 text-teal-100">History</button>
                          {canManageUsers ? <button type="button" onClick={() => deleteUser(user._id)} className="rounded-lg border border-rose-400/30 px-2 py-1 text-rose-100">Delete</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto md:hidden">
            {loading ? <p className="text-sm text-slate-300">Loading users...</p> : null}
            {!loading && users.length === 0 ? <p className="text-sm text-slate-300">No users found.</p> : null}
            {!loading && users.map((user) => (
              <div key={user._id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-300">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{user.employeeId || "No employee ID"} | {ROLE_LABELS[user.role] || user.role}</p>
                    <p className="text-xs text-slate-400">{user.department || "No department"} | {user.status}</p>
                  </div>
                  <button type="button" onClick={() => openHistory(user)} className="rounded-lg border border-teal-400/30 px-2 py-1 text-xs text-teal-100">History</button>
                </div>
                {canManageUsers ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(user)} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white">Edit</button>
                    <button type="button" onClick={() => resetPassword(user._id)} className="rounded-lg border border-amber-400/30 px-2 py-1 text-xs text-amber-100">Reset</button>
                    <button type="button" onClick={() => toggleBlock(user)} className="rounded-lg border border-sky-400/30 px-2 py-1 text-xs text-sky-100">{user.status === "blocked" ? "Activate" : "Block"}</button>
                    <button type="button" onClick={() => deleteUser(user._id)} className="rounded-lg border border-rose-400/30 px-2 py-1 text-xs text-rose-100">Delete</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-slate-300">
            <span>Page {pagination.page || filters.page} of {Math.max(1, pagination.totalPages || 1)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(pagination.page || filters.page) <= 1 || loading}
                onClick={() => setFilters((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))}
                className="rounded-xl border border-white/15 p-2 text-white disabled:opacity-40"
                aria-label="Previous users page"
              ><ChevronLeft size={15} /></button>
              <button
                type="button"
                disabled={(pagination.page || filters.page) >= (pagination.totalPages || 1) || loading}
                onClick={() => setFilters((previous) => ({ ...previous, page: previous.page + 1 }))}
                className="rounded-xl border border-white/15 p-2 text-white disabled:opacity-40"
                aria-label="Next users page"
              ><ChevronRight size={15} /></button>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-white">Role Permission Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-300">
                <th className="py-2 pr-3">Module</th>
                <th className="py-2 pr-3">Super Admin</th>
                <th className="py-2 pr-3">Admin</th>
                <th className="py-2 pr-3">Final Approvers</th>
                <th className="py-2 pr-3">Checking Roles</th>
                <th className="py-2 pr-3">Recommending Roles</th>
                <th className="py-2 pr-3">Supervisor / General</th>
                <th className="py-2 pr-3">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {modulePermissionRows.map((moduleName) => (
                <tr key={moduleName} className="border-b border-white/5 text-slate-200">
                  <td className="py-2 pr-3">{getEnterpriseModule(moduleName)?.label || moduleName.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase())}</td>
                  <td className="py-2 pr-3 text-emerald-300">Full</td>
                  <td className="py-2 pr-3">Manage</td>
                  <td className="py-2 pr-3">{ENTERPRISE_HSE_KEYS.includes(moduleName) ? "Create / Update" : "Approve"}</td>
                  <td className="py-2 pr-3">{ENTERPRISE_HSE_KEYS.includes(moduleName) ? "Create / Update" : "Check / Return"}</td>
                  <td className="py-2 pr-3">{ENTERPRISE_HSE_KEYS.includes(moduleName) ? "Manage" : "Recommend / Return"}</td>
                  <td className="py-2 pr-3">{ENTERPRISE_HSE_KEYS.includes(moduleName) ? "Create / Update" : "Create / View (no workflow action)"}</td>
                  <td className="py-2 pr-3">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {selectedUser ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
        <GlassCard className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Login History: {selectedUser.name}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-300"
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-xs text-slate-300">No history available.</p>
            ) : (
              history.map((item, index) => (
                <div
                  key={`${item.timestamp}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs"
                >
                  <p className="text-slate-200">{formatDateTime(item.timestamp)}</p>
                  <p className="text-slate-300">{item.ip || "-"}</p>
                  <p className="text-slate-300">{item.userAgent || "-"}</p>
                  <p className={item.successful ? "text-emerald-300" : "text-rose-300"}>
                    <span className="inline-flex items-center gap-1">
                      <Shield size={12} />
                      {item.successful ? "Success" : "Failed"}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* The worker's printable attendance badge. Only administrators and
            safety management can rotate a badge, so the regenerate control is
            gated on the same roles the backend enforces. */}
        <WorkerQrCard
          userId={selectedUser._id || selectedUser.id}
          canRegenerate={canRegenerateWorkerQr}
        />
        </div>
      ) : null}

      <ImageStudioModal
        open={imageModal.open}
        onClose={() => setImageModal((prev) => ({ ...prev, open: false }))}
        items={imageModal.items}
        activeIndex={imageModal.index}
        onIndexChange={(index) => setImageModal((prev) => ({ ...prev, index }))}
        compare={imageModal.compare}
      />
    </div>
  );
};

export default UsersPage;
