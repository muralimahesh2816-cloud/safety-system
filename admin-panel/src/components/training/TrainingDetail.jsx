import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  Clock3,
  HardHat,
  ShieldCheck,
  Target,
  TriangleAlert,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { modalEnter, overlayEnter } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import ActionButton from "../common/ActionButton";
import EmptyState from "../common/EmptyState";
import StatusBadge from "../common/StatusBadge";
import HseTrainingVisual from "./HseTrainingVisual";

/**
 * Full training detail.
 *
 * Layout follows the module spec: a hero, then the safety concept, objective,
 * hazards, the correct-vs-incorrect practice pair, required PPE, media and
 * assessment, split across tabs so a long concept stays readable.
 *
 * A section is only rendered when the training actually carries that content —
 * a legacy record with just a title, description and video shows exactly those
 * and nothing else, rather than a page of empty headings.
 */
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "practice", label: "Safe Practice" },
  { key: "media", label: "Media" },
  { key: "assessment", label: "Assessment" }
];

const PracticeList = ({ tone, title, icon: Icon, items }) => (
  <section
    className={`rounded-2xl border p-4 ${
      tone === "correct"
        ? "border-emerald-400/25 bg-emerald-500/[0.07]"
        : "border-rose-400/25 bg-rose-500/[0.07]"
    }`}
  >
    <h4
      className={`flex items-center gap-2 text-sm font-semibold ${
        tone === "correct" ? "text-emerald-100" : "text-rose-100"
      }`}
    >
      <Icon size={15} aria-hidden="true" />
      {title}
    </h4>
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-200">
          <span aria-hidden="true" className={tone === "correct" ? "text-emerald-300" : "text-rose-300"}>
            {tone === "correct" ? "✓" : "✕"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </section>
);

const TrainingDetail = ({
  training,
  progress = 0,
  status = "assigned",
  assessmentScore = null,
  certificate = null,
  onClose,
  onProgress,
  onGenerateCertificate,
  onViewCertificate,
  onRecordScore,
  canRecordScore = false,
  busyAction = ""
}) => {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState("overview");
  const [videoStarted, setVideoStarted] = useState(false);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  const hasAssessment = training.passingScore !== null && training.passingScore !== undefined;
  const scorePending = hasAssessment && (assessmentScore === null || assessmentScore === undefined);
  const canGenerate = status === "completed" && !certificate && !scorePending;

  const available = useMemo(
    () => ({
      practice:
        (training.hazards?.length || 0) +
          (training.correctPractice?.length || 0) +
          (training.incorrectPractice?.length || 0) >
        0,
      media: Boolean(training.videoUrl || training.thumbnailUrl || training.visualKey),
      assessment: true
    }),
    [training]
  );

  const visibleTabs = TABS.filter((entry) => entry.key === "overview" || available[entry.key]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), a[href], video, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const motionProps = reduced ? {} : modalEnter;
  const overlayProps = reduced ? {} : overlayEnter;

  return (
    <motion.div
      {...overlayProps}
      className="fixed inset-0 z-[9000] flex items-start justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.article
        {...motionProps}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${training.title} training`}
        className="my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,.6)]"
      >
        {/* -------------------------------------------------------- hero */}
        <header className="relative h-52 overflow-hidden md:h-64">
          {training.thumbnailUrl ? (
            <img src={training.thumbnailUrl} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <HseTrainingVisual name={training.visualKey} title={training.title} className="h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close training"
            className="absolute right-4 top-4 rounded-xl border border-white/20 bg-black/55 p-2 text-white transition hover:bg-black/75"
          >
            <X size={16} aria-hidden="true" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-100">
                {training.categoryLabel || training.category || "General"}
              </span>
              <StatusBadge
                status={
                  status === "in_progress"
                    ? "In Progress"
                    : status === "failed"
                    ? "Failed"
                    : status === "completed"
                    ? "Completed"
                    : "Assigned"
                }
              />
              {certificate ? <StatusBadge status="Certified" tone="success" /> : null}
            </div>
            <h2 className="mt-2.5 font-display text-2xl font-semibold leading-tight text-white md:text-3xl">
              {training.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} aria-hidden="true" /> {training.durationMinutes || training.duration || 10} min
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound size={12} aria-hidden="true" />
                {training.trainerName || training.trainer?.name || training.createdBy?.name || "Training Team"}
              </span>
              <span>{progress}% complete</span>
            </div>
          </div>
        </header>

        {/* -------------------------------------------------------- tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 md:px-6" role="tablist">
          {visibleTabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              className={`relative min-h-11 whitespace-nowrap px-3 text-xs font-semibold transition ${
                tab === entry.key ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {entry.label}
              {tab === entry.key ? (
                <motion.span
                  layoutId={reduced ? undefined : "training-tab-underline"}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand-primary-light)]"
                />
              ) : null}
            </button>
          ))}
        </div>

        {/* ----------------------------------------------------- content */}
        <div className="max-h-[52vh] overflow-y-auto p-5 md:p-6">
          {/*
            Enter-only, not `AnimatePresence mode="wait"`: a wait-mode exit
            holds the outgoing panel until its animation finishes, and
            framer-motion drives that with requestAnimationFrame, which does
            not run in a background tab. Switching tabs there left the old
            panel on screen indefinitely.
          */}
          <div>
            <motion.div
              key={tab}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
              role="tabpanel"
            >
              {tab === "overview" ? (
                <div className="space-y-5">
                  {training.objective ? (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Target size={15} className="text-[var(--brand-accent-soft)]" aria-hidden="true" />
                        Safety objective
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{training.objective}</p>
                    </section>
                  ) : null}

                  <section>
                    <h3 className="text-sm font-semibold text-white">Safety concept</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                      {training.concept || training.description}
                    </p>
                    {training.concept && training.description && training.concept !== training.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{training.description}</p>
                    ) : null}
                  </section>

                  {training.requiredPpe?.length ? (
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                        <HardHat size={15} className="text-amber-300" aria-hidden="true" />
                        Minimum PPE
                      </h3>
                      <ul className="mt-2.5 flex flex-wrap gap-2">
                        {training.requiredPpe.map((item) => (
                          <li
                            key={item}
                            className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {tab === "practice" ? (
                <div className="space-y-5">
                  {training.hazards?.length ? (
                    <section className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                        <TriangleAlert size={15} aria-hidden="true" />
                        Hazards
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {training.hazards.map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-200">
                            <span aria-hidden="true" className="text-amber-300">
                              &bull;
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/*
                    Right-vs-wrong pair. Both panels are labelled in words and
                    carry distinct glyphs, so the distinction survives greyscale
                    printing and colour-vision deficiency.
                  */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {training.correctPractice?.length ? (
                      <PracticeList
                        tone="correct"
                        title="Correct practice"
                        icon={CheckCircle2}
                        items={training.correctPractice}
                      />
                    ) : null}
                    {training.incorrectPractice?.length ? (
                      <PracticeList
                        tone="incorrect"
                        title="Unsafe practice — do not do this"
                        icon={XCircle}
                        items={training.incorrectPractice}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {tab === "media" ? (
                <div className="space-y-4">
                  {training.videoUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                      {/*
                        Nothing is fetched until the learner presses play:
                        preload="none" plus a poster keeps a catalogue of
                        training videos from costing bandwidth on page open.
                      */}
                      {videoStarted ? (
                        <video
                          src={training.videoUrl}
                          poster={training.thumbnailUrl || undefined}
                          controls
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full"
                          onEnded={() => onProgress?.(100)}
                          onTimeUpdate={(event) => {
                            const { currentTime, duration } = event.currentTarget;
                            if (!duration) return;
                            const percent = Math.round((currentTime / duration) * 100);
                            if (percent >= 95) onProgress?.(100);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVideoStarted(true)}
                          className="group relative flex aspect-video w-full items-center justify-center"
                          aria-label={`Play ${training.title} training video`}
                        >
                          {training.thumbnailUrl ? (
                            <img src={training.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <HseTrainingVisual
                              name={training.visualKey}
                              className="absolute inset-0 h-full w-full"
                              title=""
                            />
                          )}
                          <span className="absolute inset-0 bg-black/45 transition group-hover:bg-black/30" />
                          <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-black/70 px-5 py-3 text-sm font-semibold text-white">
                            <ShieldCheck size={16} aria-hidden="true" /> Play training video
                          </span>
                        </button>
                      )}
                    </div>
                  ) : null}

                  <figure className="overflow-hidden rounded-2xl border border-white/10">
                    <HseTrainingVisual
                      name={training.visualKey}
                      title={`${training.title} — instructional visual`}
                      className="aspect-video w-full"
                    />
                    <figcaption className="border-t border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] text-slate-400">
                      Instructional visual for {training.title}. Upload a photographed or rendered scene against
                      this training to replace it.
                    </figcaption>
                  </figure>
                </div>
              ) : null}

              {tab === "assessment" ? (
                <div className="space-y-4">
                  {hasAssessment ? (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <h3 className="text-sm font-semibold text-white">Assessment</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        This training requires a passing score of {training.passingScore}% before a certificate can
                        be issued.
                      </p>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {scorePending ? "Score pending" : `Your score: ${assessmentScore}%`}
                      </p>
                      {scorePending ? (
                        <p className="mt-1.5 text-xs text-amber-200">
                          {canRecordScore
                            ? "No score has been recorded for this employee yet."
                            : "Your trainer needs to record a score before a certificate can be issued."}
                        </p>
                      ) : null}
                      {canRecordScore ? (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                          loading={busyAction === "score"}
                          loadingLabel="Saving..."
                          onClick={onRecordScore}
                        >
                          Record Score
                        </ActionButton>
                      ) : null}
                    </section>
                  ) : (
                    <EmptyState
                      icon={ShieldCheck}
                      title="Assessment: Not Applicable"
                      message="No graded assessment is configured for this training. Completing the material is sufficient for certificate eligibility."
                    />
                  )}
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>

        {/* ------------------------------------------------------ footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4 md:px-6">
          <div className="min-w-0">
            <div
              className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Training progress"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-primary-light)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{progress}% complete</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {status !== "completed" ? (
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => onProgress?.(100)}
                icon={CheckCircle2}
              >
                Mark as Complete
              </ActionButton>
            ) : null}
            {canGenerate ? (
              <ActionButton
                size="sm"
                icon={ShieldCheck}
                loading={busyAction === "generate"}
                loadingLabel="Generating..."
                onClick={onGenerateCertificate}
              >
                Generate Certificate
              </ActionButton>
            ) : null}
            {certificate ? (
              <ActionButton size="sm" icon={Award} onClick={onViewCertificate}>
                View Certificate
              </ActionButton>
            ) : null}
          </div>
        </footer>
      </motion.article>
    </motion.div>
  );
};

export default TrainingDetail;
