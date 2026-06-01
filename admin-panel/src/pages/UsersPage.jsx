import { useEffect, useMemo, useState } from "react";
import { KeyRound, Lock, Shield, Unlock } from "lucide-react";
import GlassCard from "../components/common/GlassCard";
import ImageStudioModal from "../components/common/ImageStudioModal";
import SectionHeader from "../components/common/SectionHeader";
import { userService } from "../api/services";
import { ROLE_LABELS, ROLES } from "../constants/roles";
import { showSuccessPopup, showValidationPopup } from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import { resolveAssetUrl } from "../utils/media";

const initialForm = {
  name: "",
  email: "",
  mobile: "",
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
  "notifications"
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

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await userService.list();
      setUsers(response.users || []);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const canManageUsers = useMemo(
    () => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUser?.role),
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
    try {
      if (editId) {
        await userService.update(editId, {
          name: form.name,
          email: form.email,
          mobile: form.mobile,
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
      <SectionHeader
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
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              disabled={!canManageUsers}
            >
              <option value="" className="bg-slate-900 text-white">
                Select Role
              </option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-slate-900 text-white">
                  {label}
                </option>
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
                className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white"
                disabled={!canManageUsers}
              >
                {editId ? "Update User" : "Create User"}
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
          <h3 className="mb-3 text-lg font-semibold text-white">Users</h3>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-300">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-300">No users found.</p>
            ) : (
              users.map((user) => {
                const photoUrl = getUserPhoto(user);
                return (
                  <div
                    key={user._id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!photoUrl) return;
                            setImageModal({
                              open: true,
                              items: [{ url: photoUrl }],
                              index: 0,
                              compare: null
                            });
                          }}
                          className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/10"
                        >
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={user.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-teal-200">
                              {(user.name || "U").charAt(0)}
                            </div>
                          )}
                        </button>
                      <div>
                      <p className="text-sm font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-slate-300">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {ROLE_LABELS[user.role] || user.role} • {user.status}
                      </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManageUsers ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            className="rounded-xl border border-white/20 px-2.5 py-1.5 text-xs text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUser(user._id)}
                            className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-100"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(user._id)}
                            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-100"
                          >
                            <span className="inline-flex items-center gap-1">
                              <KeyRound size={12} />
                              Reset
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBlock(user)}
                            className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-2.5 py-1.5 text-xs text-sky-100"
                          >
                            <span className="inline-flex items-center gap-1">
                              {user.status === "blocked" ? <Unlock size={12} /> : <Lock size={12} />}
                              {user.status === "blocked" ? "Activate" : "Block"}
                            </span>
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openHistory(user)}
                        className="rounded-xl border border-teal-400/40 bg-teal-500/15 px-2.5 py-1.5 text-xs text-teal-100"
                      >
                        Login History
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
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
                <th className="py-2 pr-3">Safety Manager</th>
                <th className="py-2 pr-3">Supervisor</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {modulePermissionRows.map((moduleName) => (
                <tr key={moduleName} className="border-b border-white/5 text-slate-200">
                  <td className="py-2 pr-3 capitalize">{moduleName}</td>
                  <td className="py-2 pr-3 text-emerald-300">Full</td>
                  <td className="py-2 pr-3">Manage</td>
                  <td className="py-2 pr-3">Operate</td>
                  <td className="py-2 pr-3">Partial</td>
                  <td className="py-2 pr-3">Basic</td>
                  <td className="py-2 pr-3">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {selectedUser ? (
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
