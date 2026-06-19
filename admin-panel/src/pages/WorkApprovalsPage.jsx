import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, UploadCloud } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import GlassCard from "../components/common/GlassCard";
import SectionHeader from "../components/common/SectionHeader";
import MediaStudioModal from "../components/common/MediaStudioModal";
import WorkApprovalDetailsModal from "../components/modals/WorkApprovalDetailsModal";
import { workService } from "../api/services";
import {
  closeLoadingPopup,
  showConfirmPopup,
  showLoadingPopup,
  showSuccessPopup,
  showValidationPopup
} from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import { getMediaUrl } from "../utils/media";

const legacyWorkTypes = [
  "Road Work",
  "Lights Changing",
  "Height Work",
  "Grass Cutting",
  "Watering Plants",
  "Plaza Maintenance"
];

const statusList = ["Pending", "Approved", "Rejected", "Completed"];

const initialForm = {
  title: "",
  workType: "",
  category: "General",
  location: "",
  chainage: "",
  workersCount: "",
  description: "",
  priority: "Medium",
  assignedTo: "",
  startDate: "",
  dueDate: ""
};

const getWorkRecordId = (work = {}) => work._id || work.id || work.workId || "";
const normalizeStatus = (status = "Pending") => String(status || "Pending").toLowerCase();
const isCompletedStatus = (status) => normalizeStatus(status) === "completed";

const WorkApprovalsPage = ({ user }) => {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [beforeImages, setBeforeImages] = useState([]);
  const [beforePreview, setBeforePreview] = useState("");
  const [afterImages, setAfterImages] = useState({});
  const [afterPreviewMap, setAfterPreviewMap] = useState({});
  const [modal, setModal] = useState({ open: false, items: [], index: 0, compare: null });
  const [selectedWork, setSelectedWork] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [busyWorkId, setBusyWorkId] = useState("");
  const submitLockRef = useRef(false);
  const workActionLockRef = useRef(false);

  const canDelete = ["super_admin", "admin"].includes(user?.role);
  const canApprove = ["super_admin", "admin"].includes(user?.role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const workRes = await workService.list();
      setRecords(workRes.records || []);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load work approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submitWork = async (event) => {
    event.preventDefault();
    setError("");

    if (
      !form.workType ||
      !form.location ||
      !form.chainage ||
      !form.workersCount ||
      !form.description.trim() ||
      beforeImages.length === 0
    ) {
      setError("Fill all required fields from legacy workflow");
      showValidationPopup("Please fill all required Work Approval fields.");
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    await showLoadingPopup("Uploading Please Wait...", "Submitting work approval...");

    try {
      await workService.create({
        ...form,
        title: form.title || `${form.workType} - ${form.location}`,
        workersCount: Number(form.workersCount),
        beforeImages
      });
      setForm(initialForm);
      setBeforeImages([]);
      if (beforePreview?.startsWith("blob:")) URL.revokeObjectURL(beforePreview);
      setBeforePreview("");
      await showSuccessPopup("Work Approval Submitted Successfully");
      fetchAll();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to submit work");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      closeLoadingPopup();
    }
  };

  const updateStatus = async (work, status) => {
    const id = getWorkRecordId(work);
    if (!id) {
      showValidationPopup("Unable to update this work record because its id is missing.");
      return;
    }
    if (isCompletedStatus(work?.status)) {
      showValidationPopup("Completed work is locked and cannot be changed.");
      return;
    }
    if (workActionLockRef.current) return;
    workActionLockRef.current = true;
    setBusyWorkId(id);
    const approvedBy = user?.name || localStorage.getItem("name") || "Admin";
    await showLoadingPopup("Uploading Please Wait...", `Updating work status to ${status}...`);
    try {
      await workService.updateStatus(id, {
        status,
        approvedBy
      });
      await showSuccessPopup(`Work ${status} Successfully`);
      fetchAll();
    } catch (statusError) {
      setError(statusError?.response?.data?.message || "Status update failed");
    } finally {
      workActionLockRef.current = false;
      setBusyWorkId("");
      closeLoadingPopup();
    }
  };

  const uploadCompletion = async (work) => {
    const id = getWorkRecordId(work);
    if (!id) {
      showValidationPopup("Unable to complete this work record because its id is missing.");
      return;
    }
    if (isCompletedStatus(work?.status)) {
      showValidationPopup("Completed work is already locked.");
      return;
    }
    const files = afterImages[id] || [];
    if (!files.length) {
      setError("Upload completion image");
      showValidationPopup("Please upload a completion image before marking work completed.");
      return;
    }
    if (workActionLockRef.current) return;
    workActionLockRef.current = true;
    setBusyWorkId(id);
    await showLoadingPopup("Uploading Please Wait...", "Uploading completion image...");
    try {
      await workService.uploadAfterImages(id, files);
      await workService.updateStatus(id, {
        status: "Completed",
        approvedBy: user?.name || localStorage.getItem("name") || "Admin"
      });
      setAfterImages((prev) => ({ ...prev, [id]: [] }));
      if (afterPreviewMap[id]?.startsWith("blob:")) URL.revokeObjectURL(afterPreviewMap[id]);
      setAfterPreviewMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await showSuccessPopup("Work Marked Completed Successfully");
      fetchAll();
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || "Image upload failed");
    } finally {
      workActionLockRef.current = false;
      setBusyWorkId("");
      closeLoadingPopup();
    }
  };

  const deleteWork = async (work) => {
    const id = getWorkRecordId(work);
    setError("");

    if (!id) {
      showValidationPopup("Unable to delete this work record because its id is missing.");
      return;
    }

    const confirmed = await showConfirmPopup({
      title: "Delete Work Approval?",
      text: "This work approval will be removed from the list.",
      confirmText: "Delete",
      cancelText: "Cancel",
      icon: "warning"
    });
    if (!confirmed) return;
    try {
      await workService.remove(id);
      setRecords((prev) => prev.filter((item) => getWorkRecordId(item) !== id));
      await showSuccessPopup("Work Approval Deleted Successfully");
      await fetchAll();
    } catch (deleteError) {
      const message = deleteError?.response?.data?.message || "Delete failed";
      setError(message);
      showValidationPopup(message);
    }
  };

  const openGallery = (work, startAt = 0) => {
    const before = (work.beforeImages?.length ? work.beforeImages : work.beforeImage ? [work.beforeImage] : [])
      .map((item) => ({ url: getMediaUrl(item) }))
      .filter((item) => Boolean(item.url));
    const after = (work.afterImages?.length ? work.afterImages : work.afterImage ? [work.afterImage] : [])
      .map((item) => ({ url: getMediaUrl(item) }))
      .filter((item) => Boolean(item.url));
    const combined = [...before, ...after];
    setModal({
      open: true,
      items: combined,
      index: Math.min(Math.max(startAt, 0), Math.max(0, combined.length - 1)),
      compare: null
    });
  };

  const filteredRecords = useMemo(() => {
    if (statusFilter === "All") return records;
    return records.filter((item) => (item.status || "Pending") === statusFilter);
  }, [records, statusFilter]);

  const chartData = useMemo(
    () => [
      { name: "Approved", value: records.filter((item) => item.status === "Approved").length },
      {
        name: "Pending",
        value: records.filter((item) => item.status === "Pending" || !item.status).length
      },
      { name: "Completed", value: records.filter((item) => item.status === "Completed").length },
      { name: "Rejected", value: records.filter((item) => item.status === "Rejected").length }
    ],
    [records]
  );

  const statusTone = (status) => {
    if (status === "Approved") return "text-green-300";
    if (status === "Rejected") return "text-rose-300";
    if (status === "Completed") return "text-blue-300";
    return "text-amber-300";
  };

  return (
    <div className="safety-bg-overlay safety-bg-work space-y-5">
      <SectionHeader
        title="Work Approval Workflow"
        subtitle="Legacy fields restored with single-admin approval lifecycle and image evidence"
      />

      <div className="grid grid-cols-1 gap-4 xl:h-[calc(100vh-180px)] xl:grid-cols-3">
        <GlassCard className="module-sticky-card p-5 xl:col-span-1">
          <h3 className="mb-3 text-lg font-semibold text-white">Submit Work Approval</h3>
          <form className="space-y-3" onSubmit={submitWork}>
            <select
              value={form.workType}
              onChange={(event) => setForm((prev) => ({ ...prev, workType: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            >
              <option value="" className="bg-slate-900 text-white">
                Select Work Type
              </option>
              {legacyWorkTypes.map((item) => (
                <option key={item} value={item} className="bg-slate-900 text-white">
                  {item}
                </option>
              ))}
            </select>
            <input
              placeholder="Location"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            />
            <input
              placeholder="Chainage No"
              value={form.chainage}
              onChange={(event) => setForm((prev) => ({ ...prev, chainage: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            />
            <input
              type="number"
              min="1"
              placeholder="Workers Count"
              value={form.workersCount}
              onChange={(event) => setForm((prev) => ({ ...prev, workersCount: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Work Description"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              required
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setBeforeImages(selected ? [selected] : []);
                if (beforePreview?.startsWith("blob:")) URL.revokeObjectURL(beforePreview);
                setBeforePreview(selected ? URL.createObjectURL(selected) : "");
              }}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
            />
            {beforePreview ? (
              <img
                src={beforePreview}
                alt="Before Work Preview"
                className="h-28 w-full rounded-xl border border-white/10 object-contain"
              />
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Submit Work"}
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-sm text-slate-200">Work Status Overview</p>
            <div className="h-[250px] min-h-[250px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart margin={{ top: 0, right: 6, left: 6, bottom: 8 }}>
                  <Pie data={chartData} dataKey="value" outerRadius={58} labelLine={false}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={["#22c55e", "#facc15", "#60a5fa", "#f43f5e"][index % 4]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px", paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </GlassCard>

        <GlassCard className="p-5 xl:col-span-2 xl:max-h-[calc(100vh-180px)] xl:overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-white">Work List</h3>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"
            >
              {["All", "Pending", "Approved", "Rejected", "Completed"].map((status) => (
                <option key={status} value={status} className="bg-slate-900 text-white">
                  {status}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-slate-300">Loading work approvals...</p>
          ) : (
            <div className="module-list-scroll space-y-4 xl:max-h-[calc(100vh-250px)] xl:overflow-y-auto xl:pr-1">
              {filteredRecords.map((work) => {
                const beforeItems = (
                  work.beforeImages?.length ? work.beforeImages : work.beforeImage ? [work.beforeImage] : []
                )
                  .map((item) => ({ url: getMediaUrl(item) }))
                  .filter((item) => Boolean(item.url));
                const afterItems = (
                  work.afterImages?.length ? work.afterImages : work.afterImage ? [work.afterImage] : []
                )
                  .map((item) => ({ url: getMediaUrl(item) }))
                  .filter((item) => Boolean(item.url));
                const beforePreview = beforeItems[0]?.url || "";
                const afterPreview = afterItems[0]?.url || "";
                const timeline = (work.timeline || [])
                  .filter((item) => {
                    const payload = `${item?.label || ""} ${item?.description || ""}`.toLowerCase();
                    return ![
                      "comment",
                      "note",
                      "signature",
                      "level 1",
                      "level 2",
                      "level 3"
                    ].some((keyword) => payload.includes(keyword));
                  })
                  .slice(-4);

                const recordId = getWorkRecordId(work);
                const workCompleted = isCompletedStatus(work.status);
                const workBusy = busyWorkId === recordId;

                return (
                  <div
                    key={recordId || work._id}
                    onClick={(event) => {
                      if (event.target.closest("button, input, select, a")) return;
                      setSelectedWork(work);
                    }}
                    className="cursor-pointer rounded-2xl border border-white/12 bg-white/5 p-4 transition duration-300 hover:border-cyan-300/30 hover:bg-white/[0.075] hover:shadow-[0_20px_50px_rgba(8,145,178,.12)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedWork(work);
                          }}
                          className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65"
                          aria-label="View work approval details"
                        >
                          {beforePreview ? (
                            <img src={beforePreview} alt="Before work" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                          ) : (
                            <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-500">No Image Available</span>
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{work.workType || work.title || "Work Approval"}</p>
                          <p className="mt-1 text-xs text-slate-300">{work.location || "-"} | {work.chainage || "-"}</p>
                          <p className="mt-1 text-xs text-slate-300">Reported By: {work.reportedBy || work.createdBy?.name || work.submittedBy?.name || "-"}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              normalizeStatus(work.status) === "completed"
                                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                : normalizeStatus(work.status) === "approved"
                                ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
                                : normalizeStatus(work.status) === "rejected"
                                ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                                : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                            }`}>
                              {work.status || "Pending"}
                            </span>
                            <span className="text-[11px] text-slate-400">Workers: {work.workersCount || "-"}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(work.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedWork(work)}
                          className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-100"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openGallery(work, 0)}
                          className="rounded-xl border border-white/20 px-2.5 py-1.5 text-xs text-white"
                        >
                          Image Gallery
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => deleteWork(work)}
                            className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-2.5 py-1.5 text-xs text-rose-100"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <p className="mb-2 text-xs font-semibold text-teal-200">Before Work</p>
                        {beforePreview ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openGallery(work, 0);
                            }}
                            className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
                          >
                            <img
                              src={beforePreview}
                              alt="Before Work"
                              loading="lazy"
                              className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                            />
                          </button>
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-xs text-slate-400">
                            Before image not available
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <p className="mb-2 text-xs font-semibold text-cyan-200">After Work</p>
                        {afterPreview ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openGallery(work, Math.max(beforeItems.length, 0));
                            }}
                            className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
                          >
                            <img
                              src={afterPreview}
                              alt="After Work"
                              loading="lazy"
                              className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                            />
                          </button>
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-xs text-slate-400">
                            After image not uploaded
                          </div>
                        )}
                      </div>
                    </div>

                    {canApprove ? (
                      workCompleted ? (
                        <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                          Completed work is locked. Status cannot be changed.
                        </p>
                      ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {statusList.map((status) => (
                          <button
                            key={`${recordId}-${status}`}
                            type="button"
                            disabled={workBusy}
                            onClick={() => updateStatus(work, status)}
                            className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                      )
                    ) : null}

                    {normalizeStatus(work.status) === "approved" ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
                        <p className="mb-1 text-xs text-slate-300">Upload Completion Image</p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const selected = event.target.files?.[0] || null;
                              setAfterImages((prev) => ({
                                ...prev,
                                [work._id]: selected ? [selected] : []
                              }));
                              if (afterPreviewMap[work._id]?.startsWith("blob:")) {
                                URL.revokeObjectURL(afterPreviewMap[work._id]);
                              }
                              setAfterPreviewMap((prev) => ({
                                ...prev,
                                [work._id]: selected ? URL.createObjectURL(selected) : ""
                              }));
                            }}
                            className="flex-1 rounded-lg border border-dashed border-white/20 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
                          />
                          <button
                            type="button"
                            disabled={workBusy}
                            onClick={() => uploadCompletion(work)}
                            className="rounded-lg bg-indigo-500/25 px-3 py-1.5 text-xs text-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1">
                              <UploadCloud size={12} />
                              Upload
                            </span>
                          </button>
                        </div>
                        {afterPreviewMap[work._id] ? (
                          <img
                            src={afterPreviewMap[work._id]}
                            alt="After Work Preview"
                            className="mt-2 h-24 w-full rounded-xl border border-white/10 object-contain"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <p className="mb-1 text-xs text-slate-300">Timeline</p>
                      <div className="max-h-24 space-y-1 overflow-y-auto pr-1">
                        {timeline.map((item, index) => (
                          <p key={`${work._id}-timeline-${index}`} className="text-xs text-slate-300">
                            <span className="text-teal-300">{item.label}</span> - {item.description} (
                            {formatDateTime(item.at)})
                          </p>
                        ))}
                        {!timeline.length ? (
                          <p className="text-xs text-slate-400">Status history will appear here.</p>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} />
                          {work.approvalHistory?.length || 0} history events
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredRecords.length === 0 ? (
                <p className="text-sm text-slate-300">
                  No work approval records available for the selected filter.
                </p>
              ) : null}
            </div>
          )}
        </GlassCard>
      </div>

      <WorkApprovalDetailsModal
        open={Boolean(selectedWork)}
        work={selectedWork}
        onClose={() => setSelectedWork(null)}
        onOpenMedia={(items, index) =>
          setModal({ open: true, items, index, compare: null })
        }
      />

      <MediaStudioModal
        open={modal.open}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        items={modal.items}
        activeIndex={modal.index}
        onIndexChange={(index) => setModal((prev) => ({ ...prev, index }))}
        compare={modal.compare}
      />
    </div>
  );
};

export default WorkApprovalsPage;
