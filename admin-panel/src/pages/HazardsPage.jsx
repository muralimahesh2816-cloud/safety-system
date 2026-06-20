import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import GlassCard from "../components/common/GlassCard";
import SectionHeader from "../components/common/SectionHeader";
import MediaStudioModal from "../components/common/MediaStudioModal";
import HazardDetailsModal from "../components/modals/HazardDetailsModal";
import { hazardService, userService } from "../api/services";
import { closeLoadingPopup, showLoadingPopup, showSuccessPopup, showValidationPopup } from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import { getMediaUrl } from "../utils/media";
import { exportHazardDetailsPdf } from "../utils/detailPdfExport";

const severityWeight = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

const likelihoodWeight = {
  Rare: 1,
  Possible: 2,
  Likely: 3,
  "Almost Certain": 4
};

const legacyPlazas = ["Sasthan Plaza", "Hejamadi Plaza", "Talapady Plaza", "Site"];
const legacyCategories = ["Hazard", "Near Miss"];
const legacyActionTeams = [
  "Maintenance Team",
  "Operation Team",
  "Kent Team",
  "Electrician Team",
  "RP Team",
  "Paramedical Team",
  "IT Team",
  "Housekeeping Team"
];

const formatFileSize = (bytes = 0) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const initialForm = {
  title: "",
  description: "",
  date: "",
  plaza: "",
  location: "",
  reportedBy: "",
  category: "",
  action: "",
  severity: "Medium",
  likelihood: "Possible",
  assignedTo: ""
};

const HazardsPage = ({ user }) => {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [evidencePreview, setEvidencePreview] = useState("");
  const [closureMap, setClosureMap] = useState({});
  const [closurePreviewMap, setClosurePreviewMap] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, items: [], index: 0, compare: null });
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [busyHazardId, setBusyHazardId] = useState("");
  const submitLockRef = useRef(false);
  const actionLockRef = useRef(false);

  const canDelete = ["super_admin", "admin"].includes(user?.role);
  const riskScore = useMemo(
    () => severityWeight[form.severity] * likelihoodWeight[form.likelihood],
    [form.severity, form.likelihood]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [hazardRes, userRes] = await Promise.all([hazardService.list(), userService.list()]);
      setRecords(hazardRes.records || []);
      setUsers(userRes.users || []);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to fetch hazards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (
      !form.date ||
      !form.plaza ||
      !form.location ||
      !form.reportedBy ||
      !form.description.trim() ||
      !form.category ||
      !form.action ||
      images.length === 0
    ) {
      setError("Fill all required legacy hazard fields");
      showValidationPopup("Please fill all required Hazard fields.");
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    await showLoadingPopup("Uploading Please Wait...", "Submitting hazard report...");

    try {
      await hazardService.create({
        ...form,
        title: form.title || `${form.category} - ${form.plaza}`,
        description:
          form.description || `${form.category} reported at ${form.location} by ${form.reportedBy}`,
        riskScore,
        evidenceImages: images
      });
      setForm(initialForm);
      setImages([]);
      if (evidencePreview?.startsWith("blob:")) URL.revokeObjectURL(evidencePreview);
      setEvidencePreview("");
      await showSuccessPopup("Hazard Submitted Successfully");
      fetchAll();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to submit hazard");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      closeLoadingPopup();
    }
  };

  const closeHazard = async (hazard) => {
    const closure = closureMap[hazard._id] || {};
    if (!closure.notes?.trim()) {
      setError("Corrective action is required to close the hazard");
      showValidationPopup("Please enter the corrective action taken before closing this hazard.");
      return;
    }
    if (!(closure.images || []).length) {
      setError("Upload after image to close hazard");
      showValidationPopup("Please upload a closure image before closing this hazard.");
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyHazardId(hazard._id);
    await showLoadingPopup("Uploading Please Wait...", "Uploading corrective action and closure image...");
    try {
      await hazardService.close(hazard._id, {
        closureNotes: closure.notes.trim(),
        closureImages: closure.images || []
      });
      setClosureMap((prev) => ({ ...prev, [hazard._id]: { images: [], notes: "" } }));
      if (closurePreviewMap[hazard._id]?.startsWith("blob:")) {
        URL.revokeObjectURL(closurePreviewMap[hazard._id]);
      }
      setClosurePreviewMap((prev) => {
        const next = { ...prev };
        delete next[hazard._id];
        return next;
      });
      await showSuccessPopup("Corrective Action Uploaded and Hazard Closed");
      fetchAll();
    } catch (closeError) {
      setError(closeError?.response?.data?.message || "Hazard closure failed");
    } finally {
      actionLockRef.current = false;
      setBusyHazardId("");
      closeLoadingPopup();
    }
  };

  const assignHazard = async (hazardId, assignedTo) => {
    if (!assignedTo) return;
    try {
      await hazardService.assign(hazardId, assignedTo);
      fetchAll();
    } catch (_error) {
      // Legacy endpoints may not support assignment; keep silent.
    }
  };

  const exportPdf = async (hazard) => {
    try {
      await exportHazardDetailsPdf(hazard);
    } catch (_error) {
      setError("Unable to generate the Hazard PDF");
    }
  };

  const openGallery = (hazard, startAt = 0) => {
    const evidence = (
      hazard.evidenceImages?.length
        ? hazard.evidenceImages
        : hazard.beforeImage
        ? [hazard.beforeImage]
        : []
    )
      .map((item) => ({ url: getMediaUrl(item) }))
      .filter((item) => Boolean(item.url));
    const closure = (
      hazard.closureImages?.length
        ? hazard.closureImages
        : hazard.afterImage
        ? [hazard.afterImage]
        : []
    )
      .map((item) => ({ url: getMediaUrl(item) }))
      .filter((item) => Boolean(item.url));
    const assets = [...evidence, ...closure];
    setModal({
      open: true,
      items: assets,
      index: Math.min(Math.max(startAt, 0), Math.max(0, assets.length - 1)),
      compare: null
    });
  };

  const filteredRecords = useMemo(() => {
    if (statusFilter === "All") return records;
    return records.filter((item) => (item.status === "Closed" ? "Closed" : "Open") === statusFilter);
  }, [records, statusFilter]);

  const deleteHazard = async (id) => {
    if (!window.confirm("Delete this hazard?")) return;
    try {
      await hazardService.remove(id);
      fetchAll();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || "Delete failed");
    }
  };

  const chartData = useMemo(
    () => [
      { name: "Closed", value: records.filter((item) => item.status === "Closed").length },
      {
        name: "Open",
        value: records.filter((item) => item.status !== "Closed").length
      }
    ],
    [records]
  );

  return (
    <div className="safety-bg-overlay safety-bg-hazard space-y-5">
      <SectionHeader
        title="Hazard & Risk Management"
        subtitle="Legacy hazard fields and workflows restored with enterprise risk operations UX"
      />

      <div className="grid grid-cols-1 gap-4 xl:h-[calc(100vh-180px)] xl:grid-cols-3">
        <GlassCard className="module-sticky-card p-5 xl:col-span-1">
          <h3 className="mb-3 text-lg font-semibold text-white">Report Hazard</h3>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                required
              />
              <select
                value={form.plaza}
                onChange={(event) => setForm((prev) => ({ ...prev, plaza: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                required
              >
                <option value="" className="bg-slate-900 text-white">
                  Select Plaza
                </option>
                {legacyPlazas.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Location & Chainage"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            />
            <input
              value={form.reportedBy}
              onChange={(event) => setForm((prev) => ({ ...prev, reportedBy: event.target.value }))}
              placeholder="Reported By"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              required
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Hazard Description"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-300/60 focus:outline-none"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                required
              >
                <option value="" className="bg-slate-900 text-white">
                  Category
                </option>
                {legacyCategories.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={form.action}
                onChange={(event) => setForm((prev) => ({ ...prev, action: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                required
              >
                <option value="" className="bg-slate-900 text-white">
                  Action Team
                </option>
                {legacyActionTeams.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.severity}
                onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              >
                {Object.keys(severityWeight).map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={form.likelihood}
                onChange={(event) => setForm((prev) => ({ ...prev, likelihood: event.target.value }))}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              >
                {Object.keys(likelihoodWeight).map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={form.assignedTo}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="" className="bg-slate-900 text-white">
                Assign To (Optional)
              </option>
              {users.map((item) => (
                <option key={item._id} value={item._id} className="bg-slate-900 text-white">
                  {item.name}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
              Risk Matrix Score: <span className="font-semibold text-teal-300">{riskScore}</span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setImages(selected ? [selected] : []);
                if (evidencePreview?.startsWith("blob:")) URL.revokeObjectURL(evidencePreview);
                setEvidencePreview(selected ? URL.createObjectURL(selected) : "");
              }}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
            />
            {evidencePreview ? (
              <img
                src={evidencePreview}
                alt="Evidence Preview"
                className="h-28 w-full rounded-xl border border-white/10 object-contain"
              />
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Submit Hazard"}
            </button>
          </form>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-sm text-slate-200">Hazard Status Overview</p>
            <div className="h-[250px] min-h-[250px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart margin={{ top: 0, right: 6, left: 6, bottom: 8 }}>
                  <Pie data={chartData} dataKey="value" outerRadius={58} labelLine={false}>
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={["#22c55e", "#facc15"][index % 2]} />
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
            <h3 className="text-lg font-semibold text-white">Hazard Log</h3>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"
            >
              {["All", "Open", "Closed"].map((status) => (
                <option key={status} value={status} className="bg-slate-900 text-white">
                  {status}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-slate-300">Loading hazards...</p>
          ) : (
            <div className="module-list-scroll space-y-4 xl:max-h-[calc(100vh-250px)] xl:overflow-y-auto xl:pr-1">
              {filteredRecords.map((hazard) => {
                const evidenceItems = (
                  hazard.evidenceImages?.length
                    ? hazard.evidenceImages
                    : hazard.beforeImage
                    ? [hazard.beforeImage]
                    : []
                )
                  .map((item) => ({ url: getMediaUrl(item) }))
                  .filter((item) => Boolean(item.url));
                const closureItems = (
                  hazard.closureImages?.length
                    ? hazard.closureImages
                    : hazard.afterImage
                    ? [hazard.afterImage]
                    : []
                )
                  .map((item) => ({ url: getMediaUrl(item) }))
                  .filter((item) => Boolean(item.url));
                const evidencePreview = evidenceItems[0]?.url || "";
                const closurePreview = closureItems[0]?.url || "";

                return (
                  <div
                    key={hazard._id}
                    onClick={(event) => {
                      if (event.target.closest("button, input, select, a")) return;
                      setSelectedHazard(hazard);
                    }}
                    className="cursor-pointer rounded-2xl border border-white/12 bg-white/5 p-4 transition duration-300 hover:border-cyan-300/30 hover:bg-white/[0.075] hover:shadow-[0_20px_50px_rgba(8,145,178,.12)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedHazard(hazard);
                        }}
                        className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65"
                        aria-label="View hazard details"
                      >
                        {evidencePreview ? (
                          <img src={evidencePreview} alt="Hazard evidence" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                        ) : (
                          <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-500">No Image Available</span>
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">{hazard.title || hazard.plaza || "Hazard Observation"}</p>
                        <p className="mt-1 text-xs text-slate-300">{hazard.category || "Hazard"} | {hazard.location || "-"}</p>
                        <p className="mt-1 text-xs text-slate-300">Reported By: {hazard.reportedBy || "-"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                            {hazard.severity || "Risk"} / {hazard.riskScore || 0}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            hazard.status === "Closed"
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                              : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                          }`}>
                            {hazard.status === "Closed" ? "Closed" : "Open"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{formatDateTime(hazard.date || hazard.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedHazard(hazard)}
                        className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-100"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => openGallery(hazard, 0)}
                        className="rounded-xl border border-white/20 px-2.5 py-1.5 text-xs text-white"
                      >
                        Evidence
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPdf(hazard)}
                        className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs text-cyan-100"
                      >
                        PDF
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => deleteHazard(hazard._id)}
                          className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-100"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <p className="mb-2 text-xs font-semibold text-amber-200">Evidence Image</p>
                        {evidencePreview ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openGallery(hazard, 0);
                            }}
                            className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
                          >
                            <img
                              src={evidencePreview}
                              alt="Evidence"
                              loading="lazy"
                              className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                            />
                          </button>
                        ) : (
                          <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-xs text-slate-400">
                            Evidence image not available
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <p className="mb-2 text-xs font-semibold text-emerald-200">Closure Image</p>
                        {closurePreview ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openGallery(hazard, Math.max(evidenceItems.length, 0));
                            }}
                            className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
                          >
                            <img
                              src={closurePreview}
                              alt="Closure"
                              loading="lazy"
                              className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                            />
                          </button>
                        ) : (
                          <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-xs text-slate-400">
                            Closure image not uploaded
                          </div>
                        )}
                      </div>
                    </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <select
                      value={hazard.assignedTo?._id || hazard.assignedTo || ""}
                      onChange={(event) => assignHazard(hazard._id, event.target.value)}
                      className="rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-xs text-white"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Assign user
                      </option>
                      {users.map((item) => (
                        <option key={item._id} value={item._id} className="bg-slate-900 text-white">
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hazard.status !== "Closed" ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                          Action Taken <span className="text-rose-300">*</span>
                        </span>
                        <textarea
                          value={closureMap[hazard._id]?.notes || ""}
                          onChange={(event) =>
                            setClosureMap((prev) => ({
                              ...prev,
                              [hazard._id]: {
                                ...(prev[hazard._id] || {}),
                                notes: event.target.value
                              }
                            }))
                          }
                          rows={3}
                          maxLength={1000}
                          placeholder="Enter the corrective action completed before uploading closure evidence"
                          className="w-full resize-none rounded-xl border border-emerald-400/20 bg-slate-900/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:outline-none"
                        />
                        <span className="mt-1 block text-right text-[10px] text-slate-500">
                          {(closureMap[hazard._id]?.notes || "").length}/1000
                        </span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] || null;
                          setClosureMap((prev) => ({
                            ...prev,
                            [hazard._id]: {
                              ...(prev[hazard._id] || {}),
                              images: selected ? [selected] : []
                            }
                          }));
                          if (closurePreviewMap[hazard._id]?.startsWith("blob:")) {
                            URL.revokeObjectURL(closurePreviewMap[hazard._id]);
                          }
                          setClosurePreviewMap((prev) => ({
                            ...prev,
                            [hazard._id]: selected ? URL.createObjectURL(selected) : ""
                          }));
                        }}
                        className="rounded-xl border border-dashed border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => closeHazard(hazard)}
                        disabled={busyHazardId === hazard._id}
                        className="rounded-xl bg-emerald-500/20 px-3 py-2 text-xs text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyHazardId === hazard._id ? "Uploading..." : "Upload & Close Hazard"}
                      </button>
                      {closurePreviewMap[hazard._id] ? (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 md:col-span-2">
                          <img
                            src={closurePreviewMap[hazard._id]}
                            alt="Closure preview"
                            className="h-20 w-28 shrink-0 rounded-lg border border-white/10 object-contain"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-emerald-100">
                              {closureMap[hazard._id]?.images?.[0]?.name || "Closure image selected"}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatFileSize(closureMap[hazard._id]?.images?.[0]?.size)}
                              {closureMap[hazard._id]?.images?.[0]?.type
                                ? ` | ${closureMap[hazard._id].images[0].type}`
                                : ""}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-emerald-300">
                              Ready to upload as closure evidence
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 md:col-span-2">
                          Select a closure image to preview its upload details.
                        </p>
                      )}
                    </div>
                  ) : null}
                  </div>
                );
              })}
              {filteredRecords.length === 0 ? (
                <p className="text-sm text-slate-300">
                  No hazards found for the selected filter.
                </p>
              ) : null}
            </div>
          )}
        </GlassCard>
      </div>

      <HazardDetailsModal
        open={Boolean(selectedHazard)}
        hazard={selectedHazard}
        onClose={() => setSelectedHazard(null)}
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

export default HazardsPage;
