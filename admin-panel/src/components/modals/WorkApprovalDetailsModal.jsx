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
import {
  getApprovedChainageFrom,
  getApprovedChainageTo,
  getChainageDisplay
} from "../../utils/chainage";
import WorkCompletionSummaryCard from "../work/WorkCompletionSummaryCard";
import DirectMediaCapture from "../media/DirectMediaCapture";

const WORKFLOW_STAGES = [
  "Pending Check",
  "Pending Recommendation",
  "Pending Final Approval",
  "Approved",
  "Partially Completed",
  "Completed",
  "Returned for Correction"
];
const CHECKING_ROLES = ["safety_officer", "safety_engineer", "site_engineer", "project_engineer", "maintenance_engineer"];
const RECOMMENDING_ROLES = ["safety_manager"];
const APPROVAL_ROLES = ["maintenance_manager", "project_manager"];
const ADMIN_OVERRIDE_ENABLED = process.env.REACT_APP_WORKFLOW_ADMIN_OVERRIDE_ENABLED === "true";
const ADMIN_OVERRIDE_ROLES = ["admin", "super_admin"];

const valueOrDash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

const normalizeRole = (role = "") => String(role || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
const getUserId = (value = {}) => String(value?.id || value?._id || value?.userId || "");
const getWorkCreatorId = (work = {}) => String(work.createdBy?._id || work.createdBy || work.createdById || "");
const isCreatorOfWork = (work = {}, user = {}) => {
  const userId = getUserId(user);
  return Boolean(userId && userId === getWorkCreatorId(work));
};
const isAssignedToWork = (work = {}, user = {}) => {
  const userId = getUserId(user);
  const assignedTo = String(work.assignedTo?._id || work.assignedTo || "");
  return Boolean(userId && assignedTo && userId === assignedTo);
};

const getWorkflowStage = (work) => {
  const safeWork = work || {};
  const status = safeWork.workflowStage || safeWork.status || "";
  if (WORKFLOW_STAGES.includes(status)) return status;
  if (status === "Pending Approval") return "Pending Final Approval";
  if (status === "Rejected") return "Returned for Correction";
  if (status === "Pending" || status === "Under Review" || !status) return "Pending Check";
  return status;
};

const hasWorkAction = (user = {}, action) => {
  const role = normalizeRole(user?.role);
  const roleFallbacks = {
    check: CHECKING_ROLES,
    recommend: RECOMMENDING_ROLES,
    approve: APPROVAL_ROLES,
    complete: [],
    return: []
  };
  if (["check", "recommend", "approve"].includes(action)) {
    if (ADMIN_OVERRIDE_ENABLED && ADMIN_OVERRIDE_ROLES.includes(role)) return true;
    return (roleFallbacks[action] || []).includes(role);
  }
  return user?.permissionMatrix?.work?.[action] === true || user?.permissions?.work?.[action] === true;
};

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source
    .map((item) => ({
      ...((item && typeof item === "object") ? item : {}),
      url: getMediaUrl(item),
      title: item?.title || item?.name || item?.originalFileName || "Work media"
    }))
    .filter((item) => Boolean(item.url));
};

const isVideoUrl = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const statusTone = (status = "Pending Check") => ({
  "Pending Check": "border-cyan-400/40 bg-cyan-500/15 text-cyan-100",
  "Pending Recommendation": "border-violet-400/40 bg-violet-500/15 text-violet-100",
  "Pending Final Approval": "border-amber-400/40 bg-amber-500/15 text-amber-100",
  Approved: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  "Partially Completed": "border-lime-400/40 bg-lime-500/15 text-lime-100",
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
        {item.mediaType === "video" || isVideoUrl(item.url) ? (
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
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClass} ${step.current ? "animate-pulse" : ""}`} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{step.label}</p>
          {step.current ? (
            <span className="mt-1 inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
              Action Required
            </span>
          ) : null}
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
  completionFiles,
  onCompletionFiles,
  onStageAction,
  onComplete,
  onEdit,
  stageDescription,
  setStageDescription,
  returnDescription,
  setReturnDescription,
  overrideReason,
  setOverrideReason,
  completionDescription,
  setCompletionDescription,
  completedChainageFrom,
  setCompletedChainageFrom,
  completedChainageTo,
  setCompletedChainageTo,
  partialCompletionReason,
  setPartialCompletionReason
}) => {
  const safeWork = work || {};
  const role = normalizeRole(user?.role);
  const isCreator = isCreatorOfWork(safeWork, user);
  const canUseAdminOverride = ADMIN_OVERRIDE_ENABLED && ADMIN_OVERRIDE_ROLES.includes(role);
  const userId = getUserId(user);
  const checkerId = String(safeWork.checkedById || safeWork.checkedBy?._id || "");
  const isChecker = Boolean(userId && checkerId && userId === checkerId);
  const recommenderId = String(safeWork.recommendedById || safeWork.recommendedBy?._id || "");
  const isRecommender = Boolean(userId && recommenderId && userId === recommenderId);
  const approvedChainageFrom = getApprovedChainageFrom(safeWork);
  const approvedChainageTo = getApprovedChainageTo(safeWork);
  const currentAction = {
    "Pending Check": {
      action: "check",
      title: "Enter review findings before checking this work",
      label: "Review Findings",
      placeholder: "Enter findings after reviewing the work location, chainage, manpower, PPE evidence, work description, and submitted media.",
      button: "CHECK WORK",
      icon: FileCheck2
    },
    "Pending Recommendation": {
      action: "recommend",
      title: "Enter recommendation remarks before recommending this work",
      label: "Recommendation Remarks",
      placeholder: "Enter Safety Manager recommendation remarks after reviewing the checker findings, chainage, submitted media, and correction history.",
      button: "RECOMMEND WORK",
      icon: ShieldCheck
    },
    "Pending Final Approval": {
      action: "approve",
      title: "Enter final approval remarks",
      label: "Approval Remarks",
      placeholder: "Enter final approval conditions and safety controls.",
      button: "FINAL APPROVE",
      icon: CheckCircle2
    }
  }[stage];

  if (stage === "Completed") return null;

  if (stage === "Returned for Correction") {
    return (
      <div className="rounded-3xl border border-rose-300/25 bg-rose-500/[0.08] p-4">
        <div className="flex items-center gap-2 text-rose-100">
          <AlertTriangle size={18} />
          <p className="font-semibold">Returned for correction</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Returned by {safeWork.returnedBy || "-"} from {safeWork.returnStage || "workflow review"} on {formatDateTime(safeWork.returnedAt)}.
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
          {safeWork.returnDescription || "Correction reason was not recorded."}
        </p>
        {isCreator && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white"
          >
            <RotateCcw size={16} />
            EDIT WORK AND RESUBMIT
          </button>
        ) : null}
      </div>
    );
  }

  if (stage === "Approved" || stage === "Partially Completed") {
    const canComplete = isCreator || isAssignedToWork(safeWork, user) || hasWorkAction(user, "complete");
    const closesRemaining =
      stage === "Partially Completed" &&
      String(completedChainageFrom || "").trim() === String(safeWork.remainingChainageFrom || "").trim() &&
      String(completedChainageTo || "").trim() === String(safeWork.remainingChainageTo || "").trim();
    const isPartialCompletion =
      !closesRemaining &&
      (String(completedChainageFrom || "").trim() !== String(approvedChainageFrom || "").trim() ||
        String(completedChainageTo || "").trim() !== String(approvedChainageTo || "").trim());
    return (
      <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-emerald-100">
          <UploadCloud size={18} />
          <p className="font-semibold">Completion Evidence</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Upload final after-work media and enter the actually completed chainage before closing this work.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Approved Chainage From</p>
            <p className="mt-1 text-sm font-semibold text-white">{approvedChainageFrom || "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Approved Chainage To</p>
            <p className="mt-1 text-sm font-semibold text-white">{approvedChainageTo || "-"}</p>
          </div>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Completed Chainage From
            </span>
            <input
              value={completedChainageFrom}
              onChange={(event) => setCompletedChainageFrom(event.target.value)}
              className="w-full rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:outline-none"
              placeholder={approvedChainageFrom || "KM 320+000"}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Completed Chainage To
            </span>
            <input
              value={completedChainageTo}
              onChange={(event) => setCompletedChainageTo(event.target.value)}
              className="w-full rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:outline-none"
              placeholder={approvedChainageTo || "KM 321+000"}
            />
          </label>
        </div>
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
        {isPartialCompletion ? (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-lime-200">
              Reason for Partial Completion
            </span>
            <textarea
              value={partialCompletionReason}
              onChange={(event) => setPartialCompletionReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Only Chainage 320+000 to 320+600 was completed due to rainfall and restricted equipment access. Remaining work will be completed in the next approved schedule."
              className="w-full resize-none rounded-2xl border border-lime-300/20 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-lime-300/60 focus:outline-none"
            />
          </label>
        ) : null}
        <div className="mt-4">
          <DirectMediaCapture
            label="Completion Evidence"
            module="work_approval"
            stage="completion"
            reference={safeWork.approvalNumber || safeWork.title || "Work Approval"}
            siteName={safeWork.location || safeWork.plaza}
            capturedBy={user?.name}
            maxImages={10}
            maxVideos={10}
            resetKey={`${safeWork._id || safeWork.id || "work"}-${stage}`}
            onChange={onCompletionFiles}
          />
        </div>
        {canComplete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onComplete?.(completionFiles, completionDescription, {
              completedChainageFrom,
              completedChainageTo,
              partialCompletionReason
            })}
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

  if (isCreator) {
    return (
      <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-cyan-100">
          <Clock3 size={18} />
          <p className="font-semibold">Workflow status</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          This work is currently at {stage}. Completed workflow history is shown in the timeline.
        </p>
      </div>
    );
  }

  if (currentAction.action === "recommend" && isChecker) {
    return (
      <div className="rounded-3xl border border-amber-300/20 bg-amber-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-amber-100">
          <Clock3 size={18} />
          <p className="font-semibold">Recommendation unavailable</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Checker and recommender separation is mandatory. This work must be recommended by Safety Manager.
        </p>
      </div>
    );
  }

  if (currentAction.action === "approve" && (isChecker || isRecommender)) {
    return (
      <div className="rounded-3xl border border-amber-300/20 bg-amber-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-amber-100">
          <Clock3 size={18} />
          <p className="font-semibold">Final approval unavailable</p>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Checker, recommender, and final approver separation is mandatory. This work must be approved by another authorized final approver.
        </p>
      </div>
    );
  }

  const Icon = currentAction.icon;
  const canPrimary = hasWorkAction(user, currentAction.action);
  const canReturn = canPrimary;

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
      {canUseAdminOverride ? (
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
            Override Reason
          </span>
          <textarea
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Required when overriding creator/checker/final approver separation."
            className="w-full resize-none rounded-2xl border border-amber-300/20 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-300/60 focus:outline-none"
          />
        </label>
      ) : null}
      {canPrimary ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStageAction?.(currentAction.action, stageDescription, { overrideReason })}
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
            <p className="text-sm font-semibold">Enter correction reason before returning this work</p>
          </div>
          <textarea
            value={returnDescription}
            onChange={(event) => setReturnDescription(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Clearly describe the correction required before this work can continue through the approval workflow."
            className="mt-3 w-full resize-none rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-300/60 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => onStageAction?.("return", returnDescription, { overrideReason })}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={14} />
            RETURN FOR CORRECTION
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
  onComplete,
  onEdit
}) => {
  const safeWork = work || null;
  const [exporting, setExporting] = useState(false);
  const [stageDescription, setStageDescription] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [completionDescription, setCompletionDescription] = useState("");
  const [completedChainageFrom, setCompletedChainageFrom] = useState("");
  const [completedChainageTo, setCompletedChainageTo] = useState("");
  const [partialCompletionReason, setPartialCompletionReason] = useState("");
  const [completionFiles, setCompletionFiles] = useState([]);
  const before = useMemo(() => normalizeMedia(safeWork?.beforeImages, safeWork?.beforeImage), [safeWork]);
  const after = useMemo(() => normalizeMedia(safeWork?.afterImages, safeWork?.afterImage), [safeWork]);
  const beforeVideos = useMemo(() => normalizeMedia(safeWork?.beforeVideos, safeWork?.beforeVideo), [safeWork]);
  const afterVideos = useMemo(() => normalizeMedia(safeWork?.afterVideos, safeWork?.afterVideo), [safeWork]);
  const beforeMedia = useMemo(() => [...before, ...beforeVideos], [before, beforeVideos]);
  const afterMedia = useMemo(() => [...after, ...afterVideos], [after, afterVideos]);
  const allMedia = useMemo(() => [...beforeMedia, ...afterMedia], [afterMedia, beforeMedia]);

  const stage = getWorkflowStage(safeWork);
  const createdBy =
    safeWork?.createdByName ||
    safeWork?.reportedBy ||
    safeWork?.createdBy?.name ||
    safeWork?.submittedBy?.name ||
    safeWork?.employeeName;
  const completionDate = ["Completed", "Partially Completed"].includes(stage)
    ? safeWork?.completedAt || safeWork?.completionDate || safeWork?.updatedAt
    : safeWork?.completionDate;
  const chainageDisplay = getChainageDisplay(safeWork || {});
  const steps = useMemo(
    () => [
      {
        label: "Created",
        completed: true,
        current: false,
        name: createdBy,
        role: safeWork?.createdByRole,
        date: safeWork?.createdAt || safeWork?.reportDate || safeWork?.startDate,
        description: safeWork?.description || safeWork?.workDescription
      },
      {
        label: "Checked",
        completed: Boolean(safeWork?.checkedAt || safeWork?.checkedBy),
        current: stage === "Pending Check",
        name: safeWork?.checkedBy,
        role: safeWork?.checkedByRole,
        date: safeWork?.checkedAt,
        description: safeWork?.checkedDescription
      },
      {
        label: "Recommended",
        completed: Boolean(safeWork?.recommendedAt || safeWork?.recommendedBy),
        current: stage === "Pending Recommendation",
        name: safeWork?.recommendedBy,
        role: safeWork?.recommendedByRole,
        date: safeWork?.recommendedAt,
        description: safeWork?.recommendedDescription
      },
      {
        label: "Approved",
        completed: Boolean(safeWork?.approvedAt || safeWork?.approvedBy),
        current: stage === "Pending Final Approval",
        name: safeWork?.approvedByName || safeWork?.approvedBy,
        role: safeWork?.approvedByRole,
        date: safeWork?.approvedAt || safeWork?.approvalDate,
        description: safeWork?.approvalDescription
      },
      {
        label: "Completed",
        completed: ["Completed", "Partially Completed"].includes(stage),
        current: stage === "Approved",
        name: safeWork?.completedBy,
        role: safeWork?.completedByRole,
        date: completionDate,
        description: safeWork?.completionDescription
      }
    ],
    [completionDate, createdBy, safeWork, stage]
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
    setOverrideReason("");
    setCompletionDescription("");
    const defaultCompletedFrom =
      stage === "Partially Completed"
        ? safeWork?.remainingChainageFrom || safeWork?.completion?.remainingChainageFrom
        : getApprovedChainageFrom(safeWork || {});
    const defaultCompletedTo =
      stage === "Partially Completed"
        ? safeWork?.remainingChainageTo || safeWork?.completion?.remainingChainageTo
        : getApprovedChainageTo(safeWork || {});
    setCompletedChainageFrom(defaultCompletedFrom || "");
    setCompletedChainageTo(defaultCompletedTo || "");
    setPartialCompletionReason("");
    setCompletionFiles([]);
  }, [safeWork, stage]);

  const openMedia = (index) => onOpenMedia?.(allMedia, index);

  const onCompletionFiles = (files) => setCompletionFiles(files || []);

  const downloadPdf = async () => {
    if (exporting || !safeWork) return;
    setExporting(true);
    try {
      await exportWorkApprovalDetailsPdf(safeWork);
    } catch (_error) {
      window.alert("Unable to generate the Work Approval PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && safeWork ? (
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
                <p className="mt-1 truncate text-sm text-slate-400">{safeWork.workType || safeWork.title || "Work Approval"}</p>
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
                    <InfoRow label="Approval No" value={safeWork.approvalNumber} />
                    <InfoRow label="Work Type" value={safeWork.workType || safeWork.title} icon={Wrench} />
                    <InfoRow label="Location" value={safeWork.location || safeWork.plaza} icon={MapPin} />
                    <InfoRow label={chainageDisplay.label} value={chainageDisplay.range} />
                    <InfoRow label="Workers Count" value={safeWork.workersCount} icon={UsersRound} />
                    <InfoRow label="Created By" value={createdBy} icon={UserRound} />
                    <InfoRow label="Created Role" value={safeWork.createdByRole} />
                    <InfoRow label="Created Date" value={formatDateTime(safeWork.reportDate || safeWork.startDate || safeWork.createdAt)} icon={CalendarDays} />
                    <InfoRow label="Current Stage" value={stage} icon={Clock3} />
                    <InfoRow label="Checked By" value={safeWork.checkedBy} />
                    <InfoRow label="Checked Date" value={safeWork.checkedAt ? formatDateTime(safeWork.checkedAt) : "-"} />
                    <InfoRow label="Recommended By" value={safeWork.recommendedBy} />
                    <InfoRow label="Recommended Date" value={safeWork.recommendedAt ? formatDateTime(safeWork.recommendedAt) : "-"} />
                    <InfoRow label="Approved By" value={safeWork.approvedByName || safeWork.approvedBy} />
                    <InfoRow label="Approved Date" value={safeWork.approvedAt || safeWork.approvalDate ? formatDateTime(safeWork.approvedAt || safeWork.approvalDate) : "-"} />
                  </div>

                  <DescriptionCard title="Work Description" value={safeWork.description || safeWork.workDescription || safeWork.details} />
                  {safeWork.checkedDescription ? <DescriptionCard title="Review Findings" value={safeWork.checkedDescription} tone="emerald" /> : null}
                  {safeWork.recommendedDescription ? <DescriptionCard title="Recommendation Remarks" value={safeWork.recommendedDescription} tone="emerald" /> : null}
                  {safeWork.approvalDescription ? <DescriptionCard title="Approval Remarks" value={safeWork.approvalDescription} tone="emerald" /> : null}
                  {safeWork.returnDescription ? <DescriptionCard title="Correction Reason" value={safeWork.returnDescription} tone="rose" /> : null}

                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Workflow Timeline</p>
                    <div className="mt-3 space-y-3">
                      {(safeWork.timeline || safeWork.approvalHistory || []).slice(-8).reverse().map((item, index) => (
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
                      {!(safeWork.timeline || safeWork.approvalHistory || []).length ? (
                        <p className="text-sm text-slate-500">Submitted {formatDateTime(safeWork.createdAt)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {["Completed", "Partially Completed"].includes(stage) ? (
                    <WorkCompletionSummaryCard work={safeWork} />
                  ) : null}
                  <ActionPanel
                    work={safeWork}
                    user={user}
                    stage={stage}
                    busy={busy}
                    completionFiles={completionFiles}
                    onCompletionFiles={onCompletionFiles}
                    onStageAction={onStageAction}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    stageDescription={stageDescription}
                    setStageDescription={setStageDescription}
                    returnDescription={returnDescription}
                    setReturnDescription={setReturnDescription}
                    overrideReason={overrideReason}
                    setOverrideReason={setOverrideReason}
                    completionDescription={completionDescription}
                    setCompletionDescription={setCompletionDescription}
                    completedChainageFrom={completedChainageFrom}
                    setCompletedChainageFrom={setCompletedChainageFrom}
                    completedChainageTo={completedChainageTo}
                    setCompletedChainageTo={setCompletedChainageTo}
                    partialCompletionReason={partialCompletionReason}
                    setPartialCompletionReason={setPartialCompletionReason}
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
