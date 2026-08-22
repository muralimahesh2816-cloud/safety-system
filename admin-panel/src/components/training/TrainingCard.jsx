import { motion } from "framer-motion";
import { Award, Clock3, PlayCircle, Trash2, UserRound } from "lucide-react";
import { DURATION, EASE } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import StatusBadge from "../common/StatusBadge";
import HseTrainingVisual from "./HseTrainingVisual";

/**
 * A single training in the catalogue grid.
 *
 * Shows everything the spec asks a training card to show — image, title,
 * category, duration, trainer, completion status, score, progress and
 * certificate state — and resolves its own primary action from that state
 * (Start / Continue / Completed / View Certificate).
 *
 * Media: an uploaded thumbnail is used when present; otherwise the concept's
 * instructional visual is rendered inline as SVG. Uploaded thumbnails are
 * lazily loaded and decoded off the main thread so a large catalogue grid does
 * not block first paint.
 */
const ACTION_BY_STATE = {
  completed: { label: "Review Training", tone: "secondary" },
  in_progress: { label: "Continue", tone: "primary" },
  failed: { label: "Retake Training", tone: "primary" },
  assigned: { label: "Start Training", tone: "primary" }
};

const TrainingCard = ({
  training,
  progress = 0,
  status = "assigned",
  assessmentScore = null,
  passingScore = null,
  certificate = null,
  onOpen,
  onViewCertificate,
  onDelete,
  deletable = false,
  deleting = false,
  index = 0
}) => {
  const reduced = useReducedMotion();
  const action = ACTION_BY_STATE[status] || ACTION_BY_STATE.assigned;
  const hasAssessment = passingScore !== null && passingScore !== undefined;
  const duration = training.durationMinutes || training.duration || 10;
  const trainer = training.trainerName || training.trainer?.name || training.createdBy?.name || "Training Team";

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE.out, delay: Math.min(index * 0.03, 0.24) }
      }
      whileHover={reduced ? undefined : { y: -4 }}
      className="enterprise-card enterprise-card--interactive group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 text-left shadow-[0_14px_40px_rgba(2,6,23,.3)]"
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-slate-900">
        {training.thumbnailUrl ? (
          <img
            src={training.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <HseTrainingVisual
            name={training.visualKey}
            title={training.title}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

        <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-100">
          {training.categoryLabel || training.category || "General"}
        </span>

        {certificate ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-100">
            <Award size={11} aria-hidden="true" /> Certified
          </span>
        ) : deletable ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${training.title}`}
            className="absolute right-3 top-3 rounded-full border border-rose-400/40 bg-black/65 p-2 text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        ) : null}

        {training.videoUrl ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 p-2 text-white">
            <PlayCircle size={17} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{training.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
          {training.concept || training.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={11} aria-hidden="true" /> {duration} min
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRound size={11} aria-hidden="true" />
            <span className="truncate">{trainer}</span>
          </span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{progress}% complete</span>
            <StatusBadge
              status={status === "in_progress" ? "In Progress" : status === "failed" ? "Failed" : status === "completed" ? "Completed" : "Assigned"}
              showIcon={false}
            />
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${training.title} progress`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                status === "failed" ? "bg-rose-400" : status === "completed" ? "bg-emerald-400" : "bg-[var(--brand-primary-light)]"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          {hasAssessment
            ? assessmentScore === null || assessmentScore === undefined
              ? `Assessment: Pending (pass ${passingScore}%)`
              : `Assessment: ${assessmentScore}% (pass ${passingScore}%)`
            : "Assessment: Not Applicable"}
        </p>

        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={onOpen}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold transition ${
              action.tone === "primary"
                ? "hse-primary-button text-white"
                : "border border-white/15 bg-white/[0.07] text-slate-100 hover:bg-white/[0.13]"
            }`}
          >
            {action.label}
          </button>
          {certificate ? (
            <button
              type="button"
              onClick={onViewCertificate}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-3 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/22"
            >
              <Award size={12} aria-hidden="true" /> Certificate
            </button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
};

export default TrainingCard;
