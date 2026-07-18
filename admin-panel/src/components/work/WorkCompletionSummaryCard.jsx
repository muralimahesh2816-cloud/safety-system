import { CircleCheckBig, Target } from "lucide-react";
import {
  calculateCompletionPercentage,
  getApprovedChainageFrom,
  getApprovedChainageTo,
  normalizeWorkStage
} from "../../utils/chainage";
import { formatDateTime } from "../../utils/format";

const rangeText = (from, to) => {
  if (!from && !to) return "-";
  if (from && to && from !== to) return `${from} to ${to}`;
  return from || to;
};

const WorkCompletionSummaryCard = ({ work = {}, compact = false, className = "" }) => {
  const status = normalizeWorkStage(work);
  if (!["Completed", "Partially Completed"].includes(status)) return null;

  const percentage = calculateCompletionPercentage(work);
  const approvedFrom = getApprovedChainageFrom(work);
  const approvedTo = getApprovedChainageTo(work);
  const completedFrom = work.completedChainageFrom || work.completion?.completedChainageFrom || "";
  const completedTo = work.completedChainageTo || work.completion?.completedChainageTo || "";
  const segments = work.remainingChainageSegments || work.completion?.remainingChainageSegments || [];
  const legacyRemaining = rangeText(
    work.remainingChainageFrom || work.completion?.remainingChainageFrom,
    work.remainingChainageTo || work.completion?.remainingChainageTo
  );
  const remainingText = segments.length
    ? segments.map((segment) => rangeText(segment.from, segment.to)).join("; ")
    : legacyRemaining;
  const partial = status === "Partially Completed";

  return (
    <section
      className={`overflow-hidden rounded-3xl border ${
        partial
          ? "border-lime-300/25 bg-gradient-to-br from-lime-500/10 via-slate-950/70 to-cyan-500/10"
          : "border-emerald-300/25 bg-gradient-to-br from-emerald-500/10 via-slate-950/70 to-cyan-500/10"
      } ${compact ? "p-4" : "p-5"} ${className}`}
      aria-label={partial ? "Partial target achieved" : "Target achieved"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-emerald-200">
            {partial ? <Target size={22} /> : <CircleCheckBig size={22} />}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Target and Completion</p>
            <h3 className="mt-1 text-lg font-bold text-white">
              {partial ? "Partial Target Achieved" : "Target Achieved"}
            </h3>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black ${partial ? "text-lime-200" : "text-emerald-200"}`}>{percentage}%</p>
          <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            partial
              ? "border-lime-300/30 bg-lime-500/10 text-lime-100"
              : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
          }`}>
            {status}
          </span>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${partial ? "bg-gradient-to-r from-lime-400 to-cyan-400" : "bg-gradient-to-r from-emerald-400 to-cyan-400"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Approved Target</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{rangeText(approvedFrom, approvedTo)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Completed Range</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{rangeText(completedFrom, completedTo)}</p>
        </div>
        {partial && remainingText !== "-" ? (
          <div className="rounded-2xl border border-lime-300/15 bg-lime-500/[0.06] p-3 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-lime-200">Remaining Range</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{remainingText}</p>
          </div>
        ) : null}
      </div>

      {partial && work.partialCompletionReason ? (
        <div className="mt-3 rounded-2xl border border-lime-300/15 bg-lime-500/[0.06] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-lime-200">Partial Completion Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{work.partialCompletionReason}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
        <span>Completed by: <strong className="text-slate-200">{work.completedBy || work.completion?.name || "-"}</strong></span>
        <span>Role: <strong className="text-slate-200">{work.completedByRole || work.completion?.role || "-"}</strong></span>
        <span>Completed on: <strong className="text-slate-200">{formatDateTime(work.completedAt || work.completion?.date || work.updatedAt)}</strong></span>
      </div>
    </section>
  );
};

export default WorkCompletionSummaryCard;
