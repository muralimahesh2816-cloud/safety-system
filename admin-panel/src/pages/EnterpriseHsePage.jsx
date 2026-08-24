import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import GlassCard from "../components/common/GlassCard";
import KpiCard from "../components/common/KpiCard";
import DirectMediaCapture from "../components/media/DirectMediaCapture";
import EvidencePreviewCard from "../components/media/EvidencePreviewCard";
import MediaStudioModal from "../components/common/MediaStudioModal";
import { enterpriseHseService } from "../api/enterpriseHse";
import { getEnterpriseModule } from "../config/enterpriseHseConfig";
import { exportHseDetailPdf, exportHseExcel, exportHsePdf } from "../utils/enterpriseReports";
import { formatDateTime } from "../utils/format";

const inputClass = "min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15";
const initialFilters = { search: "", status: "", category: "", severity: "", priority: "", site: "", dateFrom: "", dateTo: "", sortBy: "createdAt", sortDirection: "desc" };
const emptySummary = { total: 0, open: 0, overdue: 0, highRisk: 0, expiring: 0 };

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
};

const titleCase = (value = "") => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const personName = (value) => typeof value === "object" ? value?.name || "-" : value || "-";

const statusTone = (status = "") => {
  const normalized = status.toLowerCase();
  if (["closed", "verified", "approved", "published", "competent", "completed", "disposed"].some((item) => normalized.includes(item))) return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (["overdue", "expired", "critical", "cancelled", "defect", "damaged"].some((item) => normalized.includes(item))) return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  if (["active", "progress", "responding", "submitted"].some((item) => normalized.includes(item))) return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
  return "border-amber-300/25 bg-amber-500/10 text-amber-100";
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(status)}`}>{status || "-"}</span>
);

const nextStatusesFor = (module, current) => {
  if (current === "Overdue") {
    if (module.key === "compliance-calendar") return ["Evidence Pending", "Completed"];
  }
  if (module.key === "permits") {
    if (current === "Active") return ["Suspended", "Closed", "Cancelled"];
    if (current === "Suspended") return ["Active", "Closed", "Cancelled"];
    if (!["Closed", "Cancelled"].includes(current)) {
      const next = module.statuses[module.statuses.indexOf(current) + 1];
      return [next, "Cancelled"].filter(Boolean);
    }
    return [];
  }
  const next = module.statuses[module.statuses.indexOf(current) + 1];
  if (next === "Overdue") return [];
  return next ? [next] : [];
};

const createInitialForm = (module) => ({
  title: "",
  description: "",
  category: module.categories[0] || "",
  site: "",
  location: "",
  severity: module.severity ? "Medium" : "",
  priority: "Medium",
  businessDate: module.dateFields.includes("businessDate") ? new Date().toISOString().slice(0, 10) : "",
  startDate: "",
  dueDate: "",
  expiryDate: "",
  assignedTo: "",
  data: module.details.reduce((result, item) => ({ ...result, [item.name]: "" }), {}),
  checklist: module.checklist ? [{ item: "", result: "Pending", remarks: "" }] : [],
  evidence: [],
  documents: []
});

const Field = ({ definition, value, onChange }) => {
  const common = { id: definition.name, value: value || "", onChange: (event) => onChange(event.target.value), className: inputClass, required: definition.required === true };
  return (
    <label className={definition.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="text-xs font-semibold text-slate-300">{definition.label}</span>
      {definition.type === "select" ? (
        <select {...common}><option value="">Select</option>{definition.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      ) : definition.type === "textarea" ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={definition.type || "text"} min={definition.type === "number" ? "0" : undefined} />
      )}
    </label>
  );
};

const EnterpriseHsePage = ({ moduleKey, user }) => {
  const module = getEnterpriseModule(moduleKey);
  const reduceMotion = useReducedMotion();
  const filterStorageKey = `hse_filters_${moduleKey}`;
  const formStorageKey = `hse_form_expanded_${moduleKey}`;
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState(() => {
    try { return { ...initialFilters, ...JSON.parse(localStorage.getItem(filterStorageKey) || "{}") }; } catch (_error) { return initialFilters; }
  });
  const [draftSearch, setDraftSearch] = useState(filters.search || "");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState(moduleKey === "compliance-calendar" ? "calendar" : "register");
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(() => localStorage.getItem(formStorageKey) === "true");
  const [form, setForm] = useState(() => createInitialForm(module));
  const [editingId, setEditingId] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [mediaModal, setMediaModal] = useState({ open: false, items: [], index: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resetEvidence, setResetEvidence] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });
  const normalizedRole = String(user?.role || "").toLowerCase();
  const canEdit = normalizedRole !== "viewer";
  const canArchive = ["super_admin", "admin"].includes(normalizedRole);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setMessage((previous) => previous.type === "error" ? { type: "", text: "" } : previous);
    try {
      const response = await enterpriseHseService.list(moduleKey, { ...filters, page, limit: viewMode === "calendar" ? 100 : 25 });
      setRecords(response.records || []);
      setPagination(response.pagination || { page, totalPages: 1, total: response.records?.length || 0 });
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || `Unable to load ${module.label}.` });
    } finally {
      setLoading(false);
    }
  }, [filters, module.label, moduleKey, page, viewMode]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await enterpriseHseService.summary(moduleKey);
      setSummary({ ...emptySummary, ...(response.summary || {}) });
    } catch (_error) {
      setSummary(emptySummary);
    }
  }, [moduleKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((previous) => ({ ...previous, search: draftSearch }));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  useEffect(() => {
    localStorage.setItem(filterStorageKey, JSON.stringify(filters));
    loadRecords();
  }, [filterStorageKey, filters, loadRecords]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (moduleKey !== "compliance-calendar" || viewMode !== "calendar") return;
    const [year, month] = calendarMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setFilters((previous) => ({ ...previous, dateFrom: `${calendarMonth}-01`, dateTo: `${calendarMonth}-${String(lastDay).padStart(2, "0")}` }));
    setPage(1);
  }, [calendarMonth, moduleKey, viewMode]);
  useEffect(() => {
    enterpriseHseService.assignees().then((response) => setAssignees(response.users || [])).catch(() => setAssignees([]));
  }, [moduleKey]);
  useEffect(() => {
    if (!module.checklist) return;
    enterpriseHseService.checklistTemplates(moduleKey).then((response) => setChecklistTemplates(response.templates || [])).catch(() => setChecklistTemplates([]));
  }, [module.checklist, moduleKey]);

  const setFormExpanded = (value) => {
    setShowForm(value);
    localStorage.setItem(formStorageKey, String(value));
  };

  const resetForm = () => {
    setForm(createInitialForm(module));
    setEditingId("");
    setUploadProgress(0);
    setResetEvidence((value) => value + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const payload = { ...form };
      const onUploadProgress = (progressEvent) => {
        if (progressEvent.total) setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      };
      if (editingId) await enterpriseHseService.update(moduleKey, editingId, payload, onUploadProgress);
      else await enterpriseHseService.create(moduleKey, payload, onUploadProgress);
      setMessage({ type: "success", text: `${module.singular} ${editingId ? "updated" : "created"} successfully.` });
      resetForm();
      setFormExpanded(false);
      await Promise.all([loadRecords(), loadSummary()]);
    } catch (error) {
      const fields = error?.response?.data?.details?.fields;
      setMessage({ type: "error", text: fields?.length ? `Complete required fields: ${fields.join(", ")}.` : error?.response?.data?.message || `Unable to save ${module.singular}.` });
    } finally {
      setSaving(false);
    }
  };

  const editRecord = (record) => {
    setEditingId(record._id);
    setForm({
      ...createInitialForm(module),
      ...["title", "description", "category", "site", "location", "severity", "priority", "assignedTo"].reduce((result, key) => ({ ...result, [key]: typeof record[key] === "object" ? record[key]?._id || "" : record[key] || "" }), {}),
      ...module.dateFields.reduce((result, key) => ({ ...result, [key]: record[key] ? new Date(record[key]).toISOString().slice(0, key === "startDate" ? 16 : 10) : "" }), {}),
      data: { ...createInitialForm(module).data, ...(record.data || {}) },
      checklist: record.checklist?.length ? record.checklist.map(({ item, result, remarks, dueDate, actionOwner }) => ({ item, result, remarks, dueDate: dueDate ? new Date(dueDate).toISOString().slice(0, 10) : "", actionOwner: actionOwner?._id || actionOwner || "" })) : createInitialForm(module).checklist,
      evidence: [],
      documents: []
    });
    setFormExpanded(true);
    setSelectedRecord(null);
    window.requestAnimationFrame(() => document.getElementById("enterprise-hse-form")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  };

  const viewRecord = async (record) => {
    setSelectedRecord(record);
    try {
      const response = await enterpriseHseService.details(moduleKey, record._id);
      setSelectedRecord(response.record || record);
    } catch (_error) {
      setMessage({ type: "error", text: `Unable to load full ${module.singular.toLowerCase()} details.` });
    }
  };

  const transition = async (record, status) => {
    const note = window.prompt(`Add a workflow note for ${status}:`, "") ?? null;
    if (note === null) return;
    try {
      const response = await enterpriseHseService.transition(moduleKey, record._id, { status, note });
      setSelectedRecord(response.record || null);
      setMessage({ type: "success", text: `${record.recordId} moved to ${status}.` });
      await Promise.all([loadRecords(), loadSummary()]);
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Workflow transition failed." });
    }
  };

  const archiveRecord = async (record) => {
    if (!window.confirm(`Archive ${record.recordId}? The audit trail will be retained.`)) return;
    try {
      await enterpriseHseService.archive(moduleKey, record._id);
      setSelectedRecord(null);
      setMessage({ type: "success", text: `${record.recordId} archived.` });
      await Promise.all([loadRecords(), loadSummary()]);
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Unable to archive record." });
    }
  };

  const saveChecklistTemplate = async () => {
    const usableItems = form.checklist.filter((item) => item.item.trim());
    if (!usableItems.length) {
      setMessage({ type: "error", text: "Add at least one checklist requirement before saving a template." });
      return;
    }
    const name = window.prompt("Template name:", `${module.categories.includes(form.category) ? form.category : module.singular} checklist`);
    if (!name?.trim()) return;
    try {
      await enterpriseHseService.createChecklistTemplate({ name: name.trim(), moduleKey, category: form.category, items: usableItems });
      const response = await enterpriseHseService.checklistTemplates(moduleKey);
      setChecklistTemplates(response.templates || []);
      setMessage({ type: "success", text: "Reusable checklist template saved." });
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Unable to save checklist template." });
    }
  };

  const exportRecords = async (format) => {
    setExporting(true);
    try {
      const response = await enterpriseHseService.exportRecords(moduleKey, filters);
      if (format === "pdf") exportHsePdf({ module, records: response.records || [], filters });
      else exportHseExcel({ module, records: response.records || [], filters });
      setMessage({ type: "success", text: `${module.label} ${format.toUpperCase()} report generated.` });
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Unable to generate report." });
    } finally {
      setExporting(false);
    }
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => !["sortBy", "sortDirection"].includes(key) && value).length;
  const clearFilters = () => { setDraftSearch(""); setFilters(initialFilters); setPage(1); };
  const mediaItems = selectedRecord ? [...(selectedRecord.evidenceImages || []), ...(selectedRecord.evidenceVideos || [])] : [];
  const calendarCells = (() => {
    if (moduleKey !== "compliance-calendar") return [];
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, day: null, records: [] })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const dateKey = `${calendarMonth}-${String(day).padStart(2, "0")}`;
        return { key: dateKey, day, records: records.filter((record) => record.dueDate?.slice(0, 10) === dateKey) };
      })
    ];
  })();

  const changeCalendarMonth = (offset) => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  if (!module) return <p className="text-rose-200">HSE module configuration is unavailable.</p>;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={module.label}
        subtitle={`${module.description} Phase ${module.phase} enterprise module.`}
        statusCount={pagination.total}
        actions={canEdit ? (
          <button type="button" onClick={() => { if (showForm) resetForm(); setFormExpanded(!showForm); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl hse-primary-button px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30">
            {showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? "Close form" : `New ${module.singular}`}
          </button>
        ) : null}
      />

      {message.text ? (
        <div role={message.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-rose-300/25 bg-rose-500/10 text-rose-100" : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"}`}>{message.text}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard title="Total" value={summary.total} hint="Controlled records" tone="bg-cyan-500/20" />
        <KpiCard title="Open" value={summary.open} hint="Requires attention" tone="bg-amber-500/20" delay={0.03} />
        <KpiCard title="Overdue" value={summary.overdue} hint="Past target date" tone="bg-rose-500/20" delay={0.06} />
        <KpiCard title="High Risk" value={summary.highRisk} hint="High / critical" tone="bg-orange-500/20" delay={0.09} />
        <KpiCard title="Expiring" value={summary.expiring} hint="Next 30 days" tone="bg-violet-500/20" delay={0.12} />
      </div>

      <AnimatePresence initial={false}>
        {showForm ? (
          <motion.section id="enterprise-hse-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
            <GlassCard className="overflow-hidden p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-white">{editingId ? `Edit ${module.singular}` : `Create ${module.singular}`}</h2><p className="mt-1 text-xs text-slate-400">Required business fields are validated before submission. Evidence location remains visible to every authorized viewer.</p></div>
                {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200">Cancel edit</button> : null}
              </div>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-slate-300">Title *</span><input className={inputClass} value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} maxLength={300} required /></label>
                  <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Category *</span><select className={inputClass} value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))} required><option value="">Select category</option>{module.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Site / plaza</span><input className={inputClass} value={form.site} onChange={(event) => setForm((previous) => ({ ...previous, site: event.target.value }))} /></label>
                  <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Location / chainage</span><input className={inputClass} value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></label>
                  <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Assigned to</span><select className={inputClass} value={form.assignedTo} onChange={(event) => setForm((previous) => ({ ...previous, assignedTo: event.target.value }))}><option value="">Unassigned</option>{assignees.map((person) => <option key={person._id} value={person._id}>{person.name} - {person.role?.replaceAll("_", " ")}</option>)}</select></label>
                  {module.severity ? <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Severity *</span><select className={inputClass} value={form.severity} onChange={(event) => setForm((previous) => ({ ...previous, severity: event.target.value }))}>{["Low", "Medium", "High", "Critical"].map((value) => <option key={value}>{value}</option>)}</select></label> : null}
                  <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Priority</span><select className={inputClass} value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))}>{["Low", "Medium", "High", "Urgent"].map((value) => <option key={value}>{value}</option>)}</select></label>
                  {module.dateFields.map((dateField) => <label key={dateField} className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">{titleCase(dateField)} *</span><input type={dateField === "startDate" ? "datetime-local" : "date"} className={inputClass} value={form[dateField] || ""} onChange={(event) => setForm((previous) => ({ ...previous, [dateField]: event.target.value }))} required /></label>)}
                  <label className="space-y-1.5 sm:col-span-2 xl:col-span-3"><span className="text-xs font-semibold text-slate-300">Description</span><textarea rows={4} className={inputClass} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} /></label>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Module details</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {module.details.filter((definition) => !definition.showWhen || (definition.showWhen.values || [definition.showWhen.value]).includes(form[definition.showWhen.field] ?? form.data[definition.showWhen.field])).map((definition) => <Field key={definition.name} definition={definition} value={form.data[definition.name]} onChange={(value) => setForm((previous) => ({ ...previous, data: { ...previous.data, [definition.name]: value } }))} />)}
                  </div>
                </div>

                {module.checklist ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Inspection checklist</h3><div className="flex flex-wrap gap-2"><select aria-label="Load checklist template" className="min-h-10 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-xs text-slate-200" defaultValue="" onChange={(event) => { const template = checklistTemplates.find((item) => item._id === event.target.value); if (template) setForm((previous) => ({ ...previous, checklist: template.items.map((item) => ({ item: item.item, result: "Pending", remarks: item.guidance || "" })) })); event.target.value = ""; }}><option value="">Load template...</option>{checklistTemplates.map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}</select><button type="button" onClick={saveChecklistTemplate} className="rounded-xl border border-emerald-300/25 px-3 py-2 text-xs text-emerald-100">Save template</button><button type="button" onClick={() => setForm((previous) => ({ ...previous, checklist: [...previous.checklist, { item: "", result: "Pending", remarks: "" }] }))} className="rounded-xl border border-cyan-300/25 px-3 py-2 text-xs text-cyan-100"><Plus size={14} className="inline" /> Add item</button></div></div>
                    <div className="space-y-3">{form.checklist.map((item, index) => <div key={`${index}-${item._id || "new"}`} className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_170px_1fr_auto]"><input className={inputClass} placeholder="Checklist requirement" value={item.item} onChange={(event) => setForm((previous) => ({ ...previous, checklist: previous.checklist.map((row, rowIndex) => rowIndex === index ? { ...row, item: event.target.value } : row) }))} required /><select className={inputClass} value={item.result} onChange={(event) => setForm((previous) => ({ ...previous, checklist: previous.checklist.map((row, rowIndex) => rowIndex === index ? { ...row, result: event.target.value } : row) }))}>{["Pending", "Compliant", "Non-Compliant", "Not Applicable"].map((value) => <option key={value}>{value}</option>)}</select><input className={inputClass} placeholder="Remarks" value={item.remarks} onChange={(event) => setForm((previous) => ({ ...previous, checklist: previous.checklist.map((row, rowIndex) => rowIndex === index ? { ...row, remarks: event.target.value } : row) }))} /><button type="button" aria-label="Remove checklist item" onClick={() => setForm((previous) => ({ ...previous, checklist: previous.checklist.filter((_, rowIndex) => rowIndex !== index) }))} className="min-h-11 rounded-xl border border-rose-300/20 px-3 text-rose-200"><X size={15} /></button></div>)}</div>
                  </div>
                ) : null}

                <DirectMediaCapture label={`${module.singular} evidence`} module={module.key} stage="before" reference={form.title} siteName={form.site} capturedBy={user?.name || ""} maxImages={8} maxVideos={6} onChange={(evidence) => setForm((previous) => ({ ...previous, evidence }))} resetKey={resetEvidence} />

                {module.documents ? <label className="block space-y-1.5 rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-4"><span className="text-sm font-semibold text-white">Controlled documents</span><span className="block text-xs text-slate-400">PDF, Word, Excel, CSV, or text. Maximum 10 files, 100 MB each.</span><input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event) => setForm((previous) => ({ ...previous, documents: Array.from(event.target.files || []) }))} className="mt-2 block w-full text-xs text-slate-300" /></label> : null}

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-4">
                  {saving && uploadProgress ? <span className="text-xs text-cyan-200">Uploading {uploadProgress}%</span> : null}
                  <button type="button" onClick={() => { resetForm(); setFormExpanded(false); }} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm text-slate-200">Cancel</button>
                  <button type="submit" disabled={saving} className="min-h-11 rounded-xl hse-primary-button px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : `Create ${module.singular}`}</button>
                </div>
              </form>
            </GlassCard>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={`Search ${module.label.toLowerCase()}...`} className={`${inputClass} pl-9`} /></div>
          <button type="button" onClick={() => setShowFilters((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-slate-200"><Filter size={15} /> Filters {activeFilterCount ? `(${activeFilterCount})` : ""}<ChevronDown size={14} className={showFilters ? "rotate-180" : ""} /></button>
          <button type="button" onClick={() => loadRecords()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-slate-200"><RefreshCw size={15} /> Refresh</button>
          <button type="button" disabled={exporting} onClick={() => exportRecords("pdf")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/20 px-3 text-sm text-rose-100 disabled:opacity-50"><FileText size={15} /> PDF</button>
          <button type="button" disabled={exporting} onClick={() => exportRecords("xlsx")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/20 px-3 text-sm text-emerald-100 disabled:opacity-50"><FileSpreadsheet size={15} /> Excel</button>
          {moduleKey === "compliance-calendar" ? <button type="button" onClick={() => setViewMode((value) => value === "calendar" ? "register" : "calendar")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-300/20 px-3 text-sm text-violet-100"><CalendarDays size={15} /> {viewMode === "calendar" ? "Register view" : "Calendar view"}</button> : null}
        </div>
        <AnimatePresence initial={false}>{showFilters ? <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4"><select className={inputClass} value={filters.status} onChange={(event) => { setFilters((previous) => ({ ...previous, status: event.target.value })); setPage(1); }}><option value="">All statuses</option>{module.statuses.map((status) => <option key={status}>{status}</option>)}</select><select className={inputClass} value={filters.category} onChange={(event) => { setFilters((previous) => ({ ...previous, category: event.target.value })); setPage(1); }}><option value="">All categories</option>{module.categories.map((category) => <option key={category}>{category}</option>)}</select><input className={inputClass} placeholder="Site / plaza" value={filters.site} onChange={(event) => { setFilters((previous) => ({ ...previous, site: event.target.value })); setPage(1); }} /><select className={inputClass} value={filters.priority} onChange={(event) => { setFilters((previous) => ({ ...previous, priority: event.target.value })); setPage(1); }}><option value="">All priorities</option>{["Low", "Medium", "High", "Urgent"].map((value) => <option key={value}>{value}</option>)}</select><label className="text-xs text-slate-400">From<input type="date" className={`${inputClass} mt-1`} value={filters.dateFrom} onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))} /></label><label className="text-xs text-slate-400">To<input type="date" className={`${inputClass} mt-1`} value={filters.dateTo} onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))} /></label><label className="text-xs text-slate-400">Sort by<select className={`${inputClass} mt-1`} value={filters.sortBy} onChange={(event) => setFilters((previous) => ({ ...previous, sortBy: event.target.value }))}>{[["createdAt", "Newest record"], ["dueDate", "Due date"], ["expiryDate", "Expiry date"], ["title", "Title"], ["status", "Status"], ["priority", "Priority"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs text-slate-400">Direction<select className={`${inputClass} mt-1`} value={filters.sortDirection} onChange={(event) => setFilters((previous) => ({ ...previous, sortDirection: event.target.value }))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label><button type="button" onClick={clearFilters} className="min-h-11 self-end rounded-xl border border-white/15 px-3 text-sm text-slate-200">Clear filters</button></div></motion.div> : null}</AnimatePresence>
      </GlassCard>

      {moduleKey === "compliance-calendar" && viewMode === "calendar" ? (
        <GlassCard className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-white">Compliance Calendar</h2><p className="mt-1 text-xs text-slate-400">Due obligations for {new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => changeCalendarMonth(-1)} className="min-h-11 rounded-xl border border-white/15 px-3 text-slate-200" aria-label="Previous month"><ChevronLeft size={16} /></button><button type="button" onClick={() => setCalendarMonth(new Date().toISOString().slice(0, 7))} className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-slate-200">Today</button><button type="button" onClick={() => changeCalendarMonth(1)} className="min-h-11 rounded-xl border border-white/15 px-3 text-slate-200" aria-label="Next month"><ChevronRight size={16} /></button></div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">{calendarCells.map((cell) => <div key={cell.key} className={`min-h-24 rounded-xl border p-1.5 sm:min-h-32 sm:p-2 ${cell.day ? "border-white/10 bg-white/[0.035]" : "border-transparent bg-transparent"}`}>{cell.day ? <><span className="text-xs font-semibold text-slate-400">{cell.day}</span><div className="mt-1 space-y-1">{cell.records.slice(0, 3).map((record) => <button key={record._id} type="button" onClick={() => viewRecord(record)} className={`block w-full truncate rounded-lg border px-1.5 py-1 text-left text-[9px] sm:text-[10px] ${statusTone(record.status)}`} title={record.title}>{record.title}</button>)}{cell.records.length > 3 ? <span className="block text-[9px] text-slate-500">+{cell.records.length - 3} more</span> : null}</div></> : null}</div>)}</div>
        </GlassCard>
      ) : null}

      <GlassCard className={`overflow-hidden ${viewMode === "calendar" ? "hidden" : ""}`}>
        {loading ? <div className="space-y-3 p-5" aria-label="Loading records">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div> : records.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.035] text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Record</th><th className="px-4 py-3">Category / site</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record._id} className="border-b border-white/[0.07] transition hover:bg-white/[0.035]"><td className="max-w-[300px] px-4 py-4"><p className="font-semibold text-white">{record.title}</p><p className="mt-1 text-[11px] text-cyan-200">{record.recordId}</p><p className="mt-1 line-clamp-1 text-xs text-slate-400">{record.description || "No description"}</p></td><td className="px-4 py-4"><p className="text-slate-200">{record.category || "-"}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{record.site || record.location || "-"}</p></td><td className="px-4 py-4"><StatusBadge status={record.status} /></td><td className="px-4 py-4"><p className={record.severity === "Critical" ? "font-semibold text-rose-200" : "text-slate-200"}>{record.severity || "-"}</p><p className="mt-1 text-xs text-slate-400">{record.priority || "-"} priority</p></td><td className="px-4 py-4 text-xs text-slate-300"><p>{formatDate(record.businessDate || record.startDate || record.createdAt)}</p><p className="mt-1 text-slate-500">Due: {formatDate(record.dueDate || record.expiryDate)}</p></td><td className="px-4 py-4 text-xs text-slate-300">{personName(record.assignedTo)}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => viewRecord(record)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-cyan-300/20 px-3 text-xs text-cyan-100"><Eye size={14} /> View</button>{canEdit ? <button type="button" onClick={() => editRecord(record)} className="min-h-10 rounded-xl border border-white/15 px-3 text-xs text-slate-200">Edit</button> : null}</div></td></tr>)}</tbody></table></div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">{records.map((record) => <article key={record._id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-cyan-200">{record.recordId}</p><h3 className="mt-1 font-semibold text-white">{record.title}</h3></div><StatusBadge status={record.status} /></div><p className="mt-3 line-clamp-2 text-xs text-slate-400">{record.description || "No description"}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300"><span>{record.category || "-"}</span><span>{record.severity || record.priority || "-"}</span><span className="col-span-2 flex items-center gap-1"><MapPin size={12} />{record.site || record.location || "-"}</span></div><button type="button" onClick={() => viewRecord(record)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 text-sm text-cyan-100"><Eye size={15} /> View details</button></article>)}</div>
          </>
        ) : <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><ClipboardCheck size={36} className="text-slate-600" /><h3 className="mt-3 font-semibold text-white">No matching records</h3><p className="mt-1 text-sm text-slate-400">Create the first {module.singular.toLowerCase()} or clear the current filters.</p></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-400"><span>Page {pagination.page || page} of {pagination.totalPages || 1} - {pagination.total || 0} records</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/15 px-3 disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><button type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/15 px-3 disabled:opacity-40">Next <ChevronRight size={14} /></button></div></div>
      </GlassCard>

      <AnimatePresence>{selectedRecord ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hse-overlay flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}><motion.article initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={`${selectedRecord.recordId} details`} onClick={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-slate-950/95 pb-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-cyan-200">{selectedRecord.recordId}</span><StatusBadge status={selectedRecord.status} /></div><h2 className="mt-2 text-xl font-semibold text-white">{selectedRecord.title}</h2></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportHseDetailPdf({ module, record: selectedRecord })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/20 px-3 text-xs text-rose-100"><Download size={14} /> PDF</button>{canEdit ? <button type="button" onClick={() => editRecord(selectedRecord)} className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-slate-200">Edit</button> : null}{canArchive ? <button type="button" onClick={() => archiveRecord(selectedRecord)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/20 px-3 text-xs text-rose-100"><Archive size={14} /> Archive</button> : null}<button type="button" onClick={() => setSelectedRecord(null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-slate-200" aria-label="Close details"><X size={16} /></button></div></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="space-y-5"><section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 text-sm font-semibold text-white">Business details</h3><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{[["Description", selectedRecord.description], ["Category", selectedRecord.category], ["Site", selectedRecord.site], ["Location", selectedRecord.location], ["Severity", selectedRecord.severity], ["Priority", selectedRecord.priority], ["Assigned To", personName(selectedRecord.assignedTo)], ["Created By", personName(selectedRecord.createdBy) || selectedRecord.createdByName], ["Business Date", formatDate(selectedRecord.businessDate)], ["Start Date", formatDate(selectedRecord.startDate)], ["Due Date", formatDate(selectedRecord.dueDate)], ["Expiry Date", formatDate(selectedRecord.expiryDate)]].filter(([, value]) => value && value !== "-").map(([label, value]) => <div key={label} className={label === "Description" ? "sm:col-span-2" : ""}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-200">{value}</dd></div>)}</dl></section>{Object.keys(selectedRecord.data || {}).length ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 text-sm font-semibold text-white">Module details</h3><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{Object.entries(selectedRecord.data).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{titleCase(key)}</dt><dd className="mt-1 break-words text-slate-200">{String(value || "-")}</dd></div>)}</dl></section> : null}{selectedRecord.checklist?.length ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 text-sm font-semibold text-white">Checklist</h3><div className="space-y-2">{selectedRecord.checklist.map((item, index) => <div key={item._id || index} className="grid gap-2 rounded-xl border border-white/10 p-3 text-xs sm:grid-cols-[1fr_auto]"><div><p className="font-semibold text-white">{item.item}</p><p className="mt-1 text-slate-400">{item.remarks || "No remarks"}</p></div><StatusBadge status={item.result} /></div>)}</div></section> : null}{mediaItems.length ? <section><h3 className="mb-3 text-sm font-semibold text-white">Evidence and capture location</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{mediaItems.map((item, index) => <EvidencePreviewCard key={`${item.url}-${index}`} label={`Evidence ${index + 1}`} item={item} evidenceStage={item.stage} onOpen={() => setMediaModal({ open: true, items: mediaItems, index })} />)}</div></section> : null}{selectedRecord.attachments?.length ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 text-sm font-semibold text-white">Documents</h3><div className="grid gap-2 sm:grid-cols-2">{selectedRecord.attachments.map((document, index) => <a key={`${document.url}-${index}`} href={document.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-cyan-100"><FileText size={15} />{document.originalName || `Document ${index + 1}`}</a>)}</div></section> : null}</div><aside className="space-y-5">{canEdit && nextStatusesFor(module, selectedRecord.status).length ? <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.06] p-4"><h3 className="text-sm font-semibold text-white">Workflow actions</h3><p className="mt-1 text-xs text-slate-400">Each transition is time-stamped in the immutable audit trail.</p><div className="mt-3 grid gap-2">{nextStatusesFor(module, selectedRecord.status).map((status) => <button key={status} type="button" onClick={() => transition(selectedRecord, status)} className="min-h-11 rounded-xl hse-primary-button px-3 text-sm font-semibold text-white">Move to {status}</button>)}</div></section> : null}<section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><CalendarDays size={15} className="text-cyan-300" /> Activity timeline</h3><ol className="space-y-3">{(selectedRecord.history || []).slice().reverse().map((item, index) => <li key={`${item.at}-${index}`} className="relative border-l border-white/15 pl-4"><span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-cyan-300" /><p className="text-xs font-semibold text-white">{item.action}</p><p className="mt-1 text-[11px] text-slate-400">{item.fromStatus && item.toStatus ? `${item.fromStatus} to ${item.toStatus}` : item.toStatus || ""}</p>{item.note ? <p className="mt-1 text-xs text-slate-300">{item.note}</p> : null}<p className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.at)} - {personName(item.actor) || item.actorName}</p></li>)}{!selectedRecord.history?.length ? <li className="text-xs text-slate-500">No workflow activity yet.</li> : null}</ol></section></aside></div></motion.article></motion.div> : null}</AnimatePresence>
      <MediaStudioModal open={mediaModal.open} onClose={() => setMediaModal((previous) => ({ ...previous, open: false }))} items={mediaModal.items} activeIndex={mediaModal.index} onIndexChange={(index) => setMediaModal((previous) => ({ ...previous, index }))} />
    </div>
  );
};

export default EnterpriseHsePage;
