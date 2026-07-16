import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  UserRound,
  Wrench,
  X
} from "lucide-react";
import { formatDateTime } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";
import { exportWorkApprovalDetailsPdf } from "../../utils/detailPdfExport";
import { formatChainageRange, getChainageFrom, getChainageTo } from "../../utils/chainage";

const WORKFLOW_STAGES = [
  "Pending Check",
  "Pending Recommendation",
  "Pending Approval",
  "Approved",
  "Completed",
  "Returned for Correction"
];

const valueOrDash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

const normalizeRole = (role = "") => String(role || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");

const getWorkflowStage = (work = {}) => {
  const status = work.workflowStage || work.status || "";
  if (WORKFLOW_STAGES.includes(status)) return status;
  if (status === "Rejected") return "Returned for Correction";
  if (status === "Pending" || status === "Under Review" || !status) return "Pending Check";
  return status;
};

const hasWorkAction = (user = {}, action) => {
  const role = normalizeRole(user?.role);
  if (role === "super_admin") return true;
  if (user?.permissionMatrix?.work?.[action] === true) return true;
  if (user?.permissions?.work?.[action] === true) return true;
  const roleFallbacks = {
    check: ["admin", "safety_manager", "supervisor"],
    recommend: ["admin", "safety_manager"],
    approve: ["admin"],
    complete: ["admin", "safety_manager", "supervisor"],
    return: ["admin", "safety_manager", "supervisor"]
  };
  return (roleFallbacks[action] || []).includes(role);
};

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source
    .map((item) => ({ url: getMediaUrl(item), title: item?.title || item?.name || "Work media" }))
    .filter((item) => Boolean(item.url));
};

const isVideoUrl = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const statusTone = (status = "Pending Check") => ({
  "Pending Check": "border-cyan-400/40 bg-cyan-500/15 text-cyan-100",
  "Pending Recommendation": "border-violet-400/40 bg-violet-500/15 text-violet-100",
  "Pending Approval": "border-amber-400/40 bg-amber-500/15 text-amber-100",
  Approved: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  "Returned for Correction": "border-rose-400/40 bg-rose-500/15 text-rose-100",
  Completed: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
}[status] || "border-slate-400/40 bg-slate-500/15 text-slate-200");

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-white/[0.08] py-3 last:border-b-0 sm:grid-cols-[155px_minmax(0,1fr)]">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {Icon ? <Icon size={14} className="shrink-0 text-cyan-300" /> : null}
      {label}
    </div>
    <div className="min-w-0 break-words text-sm font-medium text-slate-100">{valueOrDash(value)}</div>
  </div>
);

const DescriptionCard = ({ title, value, tone = "cyan" }) => {
  const toneClass = tone === "rose"
    ? "border-rose-400/15 bg-rose-500/[0.07] text-rose-200"
    : tone === "emerald"
    ? "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-200"
    : "border-cyan-400/15 bg-cyan-500/[0.06] text-cyan-200";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em]">{title}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
        {value || "No description entered."}
      </p>
    </div>
  );
};

const ImagePanel = ({ label, tone, item, onOpen }) => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} className={tone} />
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
      {item ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-cyan-500/20"
            aria-label={`Open ${label}`}
          >
            <Maximize2 size={15} />
          </button>
          <a
            href={item.url}
            download
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-emerald-500/20"
            aria-label={`Download ${label}`}
          >
            <Download size={15} />
          </a>
        </div>
      ) : null}
    </div>
    {item ? (
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-56 w-full items-center justify-center overflow-hidden bg-slate-950/70 p-3 sm:h-64"
      >
        {isVideoUrl(item.url) ? (
          <video src={item.url} muted playsInline className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.02]" />
        ) : (
          <img src={item.url} alt={label} loading="lazy" className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.02]" />
        )}
      </button>
    ) : (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500 sm:h-64">No Media Available</div>
    )}
  </div>
);

const WorkflowStep = ({ step }) => {
  const stateClass = step.current
    ? "border-cyan-300/50 bg-cyan-500/15 shadow-[0_0_28px_rgba(34,211,238,.16)]"
    : step.completed
    ? "border-emerald-300/25 bg-emerald-500/10"
    : "border-white/10 bg-white/[0.035]";
  const dotClass = step.current
    ? "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.85)]"
    : step.completed
    ? "bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,.55)]"
    : "bg-slate-600";

  return (
    <div className={`rounded-2xl border p-3 transition ${stateClass}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClass}`} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{step.label}</p>
          <p className="mt-1 text-xs text-slate-300">{valueOrDash(step.name)}</p>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{valueOrDash(step.role)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{step.date ? formatDateTime(step.date) : step.current ? "Current stage" : "Pending"}</p>
          {step.description ? (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">{step.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const ActionPanel = ({
  work,
  user,
  stage,
  busy,
  completionPreview,
  completionFiles,
  onCompletionFiles,
  onStageAction,
  onComplete,
  stageDescription,
  setStageDescription,
  returnDescription,
  setReturnDescription,
  completionDescription,
  setCompletionDescription
}) => {
  const currentAction = {
    "Pending Check": {
      action: "check",
      title: "Check Work",
      label: "Checked Description",
      placeholder: "Enter review findings before checking this work.",
      button: "CHECK WORK",
      icon: FileCheck2
    },
    "Pending Recommendation": {
      action: "recommend",
      title: "Recommend Work",
      label: "Recommended Description",
      placeholder: "Enter why this work is recommended for final approval.",
      button: "RECOMMEND WORK",
      icon: ShieldCheck
    },
    "Pending Approval": {
      action: "approve",
      title: "Final Approval",
      label: "Approval Description",
      placeholder: "Enter final approval conditions and safety controls.",
      button: "FINAL APPROVAL",
      icon: CheckCircle2
    }
  }[stage];

  if (stage === "Completed") {
    return (
      <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/[0.08] p-4">
        <div className="flex items-center gap-2 text-emerald-100">
          <CheckCircle2 size={18} />
          <p className="font-semibold">Workflow completed</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Work was completed by {work.completedBy || work.approvedBy || "-"} on {formatDateTime(work.completedAt || work.completionDate || work.updatedAt)}.
        </p>
        {work.completionDescription ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{work.completionDescription}</p>
        ) : null}
      </div>
    );
  }

  if (stage === "Returned for Correction") {
    return (
      <div className="rounded-3xl border border-rose-300/25 bg-rose-500/[0.08] p-4">
        <div className="flex items-center gap-2 text-rose-100">
          <AlertTriangle size={18} />
          <p className="font-semibold">Returned for correction</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Returned by {work.returnedBy || "-"} from {work.returnStage || "workflow review"} on {formatDateTime(work.returnedAt)}.
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
          {work.returnDescription || "Correction reason was not recorded."}
        </p>
      </div>
    );
  }

  if (stage === "Approved") {
    const canComplete = hasWorkAction(user, "complete");
    return (
      <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-emerald-100">
          <UploadCloud size={18} />
          <p className="font-semibold">Completion Evidence</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Upload final after-work media and enter completion remarks before marking this work completed.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Completion Description
          </span>
          <textarea
            value={completionDescription}
            onChange={(event) => setCompletionDescription(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Describe completion evidence, final condition, and safety closure."
            className="w-full resize-none rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:outline-none"
          />
        </label>
        <input
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm"
          multiple
          onChange={onCompletionFiles}
          className="mt-3 w-full rounded-2xl border border-dashed border-white/20 bg-slate-950/70 px-4 py-3 text-xs text-slate-300"
        />
        {completionPreview ? (
          (completionFiles[0]?.type?.startsWith("video/") || isVideoUrl(completionPreview)) ? (
            <video src={completionPreview} controls className="mt-3 max-h-52 w-full rounded-2xl border border-white/10 object-contain" />
          ) : (
            <img src={completionPreview} alt="Completion preview" className="mt-3 max-h-52 w-full rounded-2xl border border-white/10 object-contain" />
          )
        ) : null}
        {completionFiles.length ? (
          <p className="mt-2 text-xs text-slate-400">Selected {completionFiles.length} completion file(s)</p>
        ) : null}
        {canComplete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onComplete?.(completionFiles, completionDescription)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_20px_45px_rgba(16,185,129,.2)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            MARK COMPLETED
          </button>
        ) : (
          <p className="mt-2 text-xs text-amber-200">Your role can view this stage, but cannot complete it.</p>
        )}
      </div>
    );
  }

  if (!currentAction) {
    return null;
  }

  const Icon = currentAction.icon;
  const canPrimary = hasWorkAction(user, currentAction.action);
  const canReturn = hasWorkAction(user, "return");

  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/[0.07] p-4">
      <div className="flex items-center gap-2 text-cyan-100">
        <Icon size={18} />
        <p className="font-semibold">{currentAction.title}</p>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {currentAction.label}
        </span>
        <textarea
          value={stageDescription}
          onChange={(event) => setStageDescription(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={currentAction.placeholder}
          className="w-full resize-none rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
        />
      </label>
      {canPrimary ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStageAction?.(currentAction.action, stageDescription)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_20px_45px_rgba(8,145,178,.2)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon size={16} />
          {currentAction.button}
        </button>
      ) : (
        <p className="mt-2 text-xs text-amber-200">Your role can view this stage, but cannot perform this action.</p>
      )}

      {canReturn ? (
        <div className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-500/[0.055] p-3">
          <div className="flex items-center gap-2 text-rose-100">
            <RotateCcw size={15} />
            <p className="text-sm font-semibold">Return for Correction</p>
          </div>
          <textarea
            value={returnDescription}
            onChange={(event) => setReturnDescription(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Enter correction reason before returning this work."
            className="mt-3 w-full resize-none rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-300/60 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => onStageAction?.("return", returnDescription)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={14} />
            RETURN
          </button>
        </div>
      ) : null}
    </div>
  );
};

const WorkApprovalDetailsModal = ({
  open,
  work,
  user,
  busy = false,
  onClose,
  onOpenMedia,
  onStageAction,
  onComplete
}) => {
  const [exporting, setExporting] = useState(false);
  const [stageDescription, setStageDescription] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [completionDescription, setCompletionDescription] = useState("");
  const [completionFiles, setCompletionFiles] = useState([]);
  const [completionPreview, setCompletionPreview] = useState("");
  const before = useMemo(() => normalizeMedia(work?.beforeImages, work?.beforeImage), [work]);
  const after = useMemo(() => normalizeMedia(work?.afterImages, work?.afterImage), [work]);
  const beforeVideos = useMemo(() => normalizeMedia(work?.beforeVideos, work?.beforeVideo), [work]);
  const afterVideos = useMemo(() => normalizeMedia(work?.afterVideos, work?.afterVideo), [work]);
  const beforeMedia = useMemo(() => [...before, ...beforeVideos], [before, beforeVideos]);
  const afterMedia = useMemo(() => [...after, ...afterVideos], [after, afterVideos]);
  const allMedia = useMemo(() => [...beforeMedia, ...afterMedia], [afterMedia, beforeMedia]);

  const stage = getWorkflowStage(work);
  const createdBy =
    work?.createdByName ||
    work?.reportedBy ||
    work?.createdBy?.name ||
    work?.submittedBy?.name ||
    work?.employeeName;
  const completionDate = stage === "Completed"
    ? work?.completedAt || work?.completionDate || work?.updatedAt
    : work?.completionDate;
  const steps = useMemo(
    () => [
      {
        label: "Created",
        completed: true,
        current: false,
        name: createdBy,
        role: work?.createdByRole,
        date: work?.createdAt || work?.reportDate || work?.startDate,
        description: work?.description || work?.workDescription
      },
      {
        label: "Checked",
        completed: Boolean(work?.checkedAt || work?.checkedBy),
        current: stage === "Pending Check",
        name: work?.checkedBy,
        role: work?.checkedByRole,
        date: work?.checkedAt,
        description: work?.checkedDescription
      },
      {
        label: "Recommended",
        completed: Boolean(work?.recommendedAt || work?.recommendedBy),
        current: stage === "Pending Recommendation",
        name: work?.recommendedBy,
        role: work?.recommendedByRole,
        date: work?.recommendedAt,
        description: work?.recommendedDescription
      },
      {
        label: "Approved",
        completed: Boolean(work?.approvedAt || work?.approvedBy),
        current: stage === "Pending Approval",
        name: work?.approvedByName || work?.approvedBy,
        role: work?.approvedByRole,
        date: work?.approvedAt || work?.approvalDate,
        description: work?.approvalDescription
      },
      {
        label: "Completed",
        completed: stage === "Completed",
        current: stage === "Approved",
        name: work?.completedBy,
        role: work?.completedByRole,
        date: completionDate,
        description: work?.completionDescription
      }
    ],
    [completionDate, createdBy, stage, work]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    setStageDescription("");
    setReturnDescription("");
    setCompletionDescription("");
    setCompletionFiles([]);
    setCompletionPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
  }, [work?._id, stage]);

  useEffect(
    () => () => {
      if (completionPreview?.startsWith("blob:")) URL.revokeObjectURL(completionPreview);
    },
    [completionPreview]
  );

  const openMedia = (index) => onOpenMedia?.(allMedia, index);

  const onCompletionFiles = (event) => {
    const files = Array.from(event.target.files || []);
    setCompletionFiles(files);
    const selected = files[0] || null;
    setCompletionPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : "";
    });
  };

  const downloadPdf = async () => {
    if (exporting || !work) return;
    setExporting(true);
    try {
      await exportWorkApprovalDetailsPdf(work);
    } catch (_error) {
      window.alert("Unable to generate the Work Approval PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && work ? (
        <motion.div
          className="fixed inset-0 z-[90000] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Work Approval Details"
            className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-[0_35px_110px_rgba(0,0,0,.65)]"
            initial={{ y: 28, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

            <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7 sm:py-5">
              <div className="min-w-0">
                <span className={`mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone(stage)}`}>
                  {stage}
                </span>
                <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Work Approval Details</h2>
                <p className="mt-1 truncate text-sm text-slate-400">{work.workType || work.title || "Work Approval"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-60"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">{exporting ? "Preparing PDF..." : "Download Full PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-white/[0.08] p-2.5 text-slate-200 transition hover:bg-rose-500/20 hover:text-white"
                  aria-label="Close work details"
                >
                  <X size={19} />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
                {steps.map((step) => (
                  <WorkflowStep key={step.label} step={step} />
                ))}
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,.92fr)]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Wrench size={19} className="text-cyan-300" />
                      <h3 className="font-display text-base font-semibold text-white">Work Information</h3>
                    </div>
                    <InfoRow label="Approval No" value={work.approvalNumber} />
                    <InfoRow label="Work Type" value={work.workType || work.title} icon={Wrench} />
                    <InfoRow label="Location" value={work.location || work.plaza} icon={MapPin} />
                    <InfoRow label="Chainage From" value={getChainageFrom(work)} />
                    <InfoRow label="Chainage To" value={getChainageTo(work)} />
                    <InfoRow label="Chainage Range" value={formatChainageRange(work)} />
                    <InfoRow label="Workers Count" value={work.workersCount} icon={UsersRound} />
                    <InfoRow label="Created By" value={createdBy} icon={UserRound} />
                    <InfoRow label="Created Role" value={work.createdByRole} />
                    <InfoRow label="Created Date" value={formatDateTime(work.reportDate || work.startDate || work.createdAt)} icon={CalendarDays} />
                    <InfoRow label="Current Stage" value={stage} icon={Clock3} />
                    <InfoRow label="Checked By" value={work.checkedBy} />
                    <InfoRow label="Checked Date" value={work.checkedAt ? formatDateTime(work.checkedAt) : "-"} />
                    <InfoRow label="Recommended By" value={work.recommendedBy} />
                    <InfoRow label="Recommended Date" value={work.recommendedAt ? formatDateTime(work.recommendedAt) : "-"} />
                    <InfoRow label="Approved By" value={work.approvedByName || work.approvedBy} />
                    <InfoRow label="Approved Date" value={work.approvedAt || work.approvalDate ? formatDateTime(work.approvedAt || work.approvalDate) : "-"} />
                    <InfoRow label="Completion Date" value={completionDate ? formatDateTime(completionDate) : "-"} />
                  </div>

                  <DescriptionCard title="Work Description" value={work.description || work.workDescription || work.details} />
                  {work.checkedDescription ? <DescriptionCard title="Checked Description" value={work.checkedDescription} tone="emerald" /> : null}
                  {work.recommendedDescription ? <DescriptionCard title="Recommended Description" value={work.recommendedDescription} tone="emerald" /> : null}
                  {work.approvalDescription ? <DescriptionCard title="Approval Description" value={work.approvalDescription} tone="emerald" /> : null}
                  {work.returnDescription ? <DescriptionCard title="Return Description" value={work.returnDescription} tone="rose" /> : null}

                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Workflow Timeline</p>
                    <div className="mt-3 space-y-3">
                      {(work.timeline || work.approvalHistory || []).slice(-8).reverse().map((item, index) => (
                        <div key={`${item.at || item.createdAt || index}-${index}`} className="flex gap-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.label || item.status || item.description || "Work updated"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.at || item.createdAt || item.date)}</p>
                            {item.description && item.label ? (
                              <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {!(work.timeline || work.approvalHistory || []).length ? (
                        <p className="text-sm text-slate-500">Submitted {formatDateTime(work.createdAt)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <ActionPanel
                    work={work}
                    user={user}
                    stage={stage}
                    busy={busy}
                    completionPreview={completionPreview}
                    completionFiles={completionFiles}
                    onCompletionFiles={onCompletionFiles}
                    onStageAction={onStageAction}
                    onComplete={onComplete}
                    stageDescription={stageDescription}
                    setStageDescription={setStageDescription}
                    returnDescription={returnDescription}
                    setReturnDescription={setReturnDescription}
                    completionDescription={completionDescription}
                    setCompletionDescription={setCompletionDescription}
                  />
                  <ImagePanel label="Before Work Media" tone="text-teal-300" item={beforeMedia[0]} onOpen={() => openMedia(0)} />
                  <ImagePanel label="After Work Media" tone="text-emerald-300" item={afterMedia[0]} onOpen={() => openMedia(beforeMedia.length)} />
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default WorkApprovalDetailsModal;
