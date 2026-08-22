import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Upload
} from "lucide-react";
import ActionButton from "../components/common/ActionButton";
import EmptyState from "../components/common/EmptyState";
import EnterpriseCard from "../components/common/EnterpriseCard";
import PageHeader from "../components/common/PageHeader";
import StatusBadge from "../components/common/StatusBadge";
import { CardSkeleton } from "../components/common/Skeletons";
import TrainingCard from "../components/training/TrainingCard";
import TrainingDetail from "../components/training/TrainingDetail";
import { certificateService, trainingService } from "../api/services";
import {
  closeLoadingPopup,
  showConfirmPopup,
  showLoadingPopup,
  showNumberInputPopup,
  showSuccessPopup,
  showValidationPopup
} from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import {
  buildCatalogPreviews,
  buildCategoryFilters,
  catalogToFormValues,
  normalizeTraining
} from "../utils/trainingContent";
import { CATEGORIES } from "../config/hseTrainingCatalog";
import { downloadCertificatePdf, printCertificatePdf, viewCertificatePdf } from "../utils/certificatePdf";

const TRAINING_PAGE_SIZE = 60;

const initialForm = {
  title: "",
  description: "",
  category: "",
  concept: "",
  trainerName: "",
  objective: "",
  catalogId: "",
  visualKey: "",
  durationMinutes: "",
  hazards: [],
  correctPractice: [],
  incorrectPractice: [],
  requiredPpe: [],
  requiresAssessment: false,
  passingScore: "",
  validityMonths: ""
};

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");

// Maps the backend's checkCertificateEligibility() error `code` (see
// backend/src/services/certificate.service.js) to a distinct popup title, so a
// real ineligibility reason never reads as a generic validation error.
const CERTIFICATE_ERROR_TITLES = {
  NO_COMPLETION: "Training Not Started",
  NOT_COMPLETED: "Training Not Completed",
  SCORE_REQUIRED: "Assessment Score Required",
  SCORE_FAILED: "Assessment Not Passed"
};

const STATUS_LABELS = {
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  expired: "Expired"
};

const TrainingPage = ({ user }) => {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openTrainingId, setOpenTrainingId] = useState("");
  const [form, setForm] = useState(initialForm);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  // "<trainingId or certId>:<action>" while an action is in flight, so only the
  // button that was clicked shows a busy state.
  const [busyAction, setBusyAction] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState(null);
  const uploadLockRef = useRef(false);
  const uploadFormRef = useRef(null);

  const currentRole = normalizeRole(user?.role);
  const canManageConcepts = ["super_admin", "admin", "safety_manager"].includes(currentRole);

  const fetchTraining = useCallback(async ({ page = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      // The list endpoint is paginated and no longer ships every user's
      // completion history with every record, so one page covers a normal
      // catalogue; the Load More control handles anything larger.
      const requests = [trainingService.list({ page, limit: TRAINING_PAGE_SIZE })];
      if (!append) requests.push(trainingService.history(), certificateService.mine());

      const [listRes, historyRes, certRes] = await Promise.all(requests);
      setRecords((previous) => (append ? [...previous, ...(listRes.records || [])] : listRes.records || []));
      setPagination(listRes.pagination || null);
      if (!append) {
        setHistory(historyRes?.history || []);
        setCertificates(certRes?.certificates || []);
      }
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load training modules");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchTraining();
  }, [fetchTraining]);

  useEffect(
    () => () => {
      if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview]
  );

  /* ------------------------------------------------------------- data */

  // Published trainings, enriched with the HSE catalogue where a record has no
  // authored content of its own.
  const publishedTrainings = useMemo(() => records.map(normalizeTraining), [records]);

  // Curriculum concepts nothing covers yet. Only Safety Managers/Admins see
  // them — an employee cannot complete a training that does not exist.
  const catalogPreviews = useMemo(
    () => (canManageConcepts ? buildCatalogPreviews(records) : []),
    [records, canManageConcepts]
  );

  const allTrainings = useMemo(
    () => [...publishedTrainings, ...catalogPreviews],
    [publishedTrainings, catalogPreviews]
  );

  const progressByTraining = useMemo(() => {
    const map = new Map();
    history.forEach((item) => {
      map.set(String(item.trainingId || item.id), item);
    });
    return map;
  }, [history]);

  const certificateByTraining = useMemo(() => {
    const map = new Map();
    certificates.forEach((certificate) => {
      map.set(String(certificate.training), certificate);
    });
    return map;
  }, [certificates]);

  const categoryFilters = useMemo(() => buildCategoryFilters(allTrainings), [allTrainings]);

  const filteredTrainings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allTrainings.filter((item) => {
      if (activeCategory !== "all" && item.categoryKey !== activeCategory) return false;
      if (!needle) return true;
      return `${item.title} ${item.concept} ${item.description} ${item.categoryLabel}`
        .toLowerCase()
        .includes(needle);
    });
  }, [allTrainings, activeCategory, search]);

  const openTraining = useMemo(
    () => allTrainings.find((item) => item._id === openTrainingId) || null,
    [allTrainings, openTrainingId]
  );

  const completionStats = useMemo(() => {
    const completed = history.filter((item) => item.status === "completed").length;
    const total = publishedTrainings.length;
    return {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      certificates: certificates.length
    };
  }, [history, publishedTrainings.length, certificates.length]);

  // One row per training the user has ever started, merged with any issued
  // certificate — this is what makes "Generate Certificate" appear once
  // eligible, including for trainings with no certificate yet.
  const myCompletions = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        certificate: certificateByTraining.get(String(item.trainingId || item.id)) || null
      })),
    [history, certificateByTraining]
  );

  const stateFor = useCallback(
    (training) => {
      const entry = progressByTraining.get(String(training._id));
      return {
        progress: entry?.progress || 0,
        status: entry?.status || "assigned",
        assessmentScore: entry?.assessmentScore ?? null,
        certificate: certificateByTraining.get(String(training._id)) || null
      };
    },
    [progressByTraining, certificateByTraining]
  );

  /* ---------------------------------------------------------- actions */

  const busyKey = (id, action) => `${id}:${action}`;

  const updateProgress = useCallback(
    async (training, progress, seconds = 120) => {
      if (!training?._id || training.isCatalogPreview) return;
      try {
        await trainingService.updateProgress(training._id, progress, seconds);
        setHistory((previous) => {
          const next = [...previous];
          const index = next.findIndex((item) => String(item.trainingId || item.id) === String(training._id));
          const merged = {
            id: training._id,
            trainingId: training._id,
            title: training.title,
            category: training.category,
            passingScore: training.passingScore ?? null,
            progress,
            status: progress >= 100 ? "completed" : "in_progress"
          };
          if (index >= 0) {
            next[index] = {
              ...next[index],
              progress: Math.max(progress, next[index].progress || 0),
              status:
                progress >= 100 && next[index].status !== "failed" ? "completed" : next[index].status || merged.status
            };
          } else {
            next.push(merged);
          }
          return next;
        });
      } catch (_error) {
        // Legacy training endpoints may not support progress updates; the
        // learner's place in the material is not worth an error dialog.
      }
    },
    []
  );

  const generateCertificate = async (item) => {
    const key = busyKey(item.trainingId, "generate");
    setBusyAction(key);
    try {
      const response = await certificateService.generate({ trainingId: item.trainingId });
      setCertificates((previous) => [
        response.certificate,
        ...previous.filter((cert) => cert._id !== response.certificate._id)
      ]);
      await showSuccessPopup(
        response.alreadyExisted ? "Certificate Already Exists" : "Certificate Generated Successfully",
        response.alreadyExisted ? "Use View or Download below to access it." : ""
      );
    } catch (generateError) {
      const code = generateError?.response?.data?.code;
      showValidationPopup(
        generateError?.response?.data?.message || "This training is not yet eligible for a certificate.",
        CERTIFICATE_ERROR_TITLES[code] || "Certificate Not Eligible"
      );
    } finally {
      setBusyAction("");
    }
  };

  const recordAssessmentScore = async (item) => {
    const score = await showNumberInputPopup({
      title: "Record Assessment Score",
      text: `${item.title} — passing score is ${item.passingScore}%.`,
      inputLabel: "Score (%)",
      min: 0,
      max: 100
    });
    if (score === null) return;

    const key = busyKey(item.trainingId, "score");
    setBusyAction(key);
    try {
      await trainingService.recordAssessment(item.trainingId, user.id, score);
      setHistory((previous) =>
        previous.map((entry) =>
          entry.trainingId === item.trainingId
            ? {
                ...entry,
                assessmentScore: score,
                status: item.passingScore !== null && score < item.passingScore ? "failed" : "completed"
              }
            : entry
        )
      );
      await showSuccessPopup("Assessment Score Recorded");
    } catch (scoreError) {
      showValidationPopup(
        scoreError?.response?.data?.message || "Could not record the assessment score.",
        "Could Not Save Score"
      );
    } finally {
      setBusyAction("");
    }
  };

  const runCertificateAction = async (certificate, action, run, failureMessage) => {
    const key = busyKey(certificate._id, action);
    setBusyAction(key);
    try {
      await run(certificate);
      certificateService.logAction(certificate._id, action === "download" ? "downloaded" : `${action}ed`);
    } catch (_actionError) {
      showValidationPopup(failureMessage, "Certificate Unavailable");
    } finally {
      setBusyAction("");
    }
  };

  const openVerifyPage = (certificate) => {
    window.open(
      `${window.location.origin}/verify?code=${certificate.verificationCode}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const prefillFromCatalog = (training) => {
    setForm({
      ...initialForm,
      ...catalogToFormValues({
        id: training.catalogId,
        title: training.title,
        concept: training.concept,
        category: training.categoryKey,
        objective: training.objective,
        duration: training.durationMinutes,
        visual: training.visualKey,
        hazards: training.hazards,
        correctPractice: training.correctPractice,
        incorrectPractice: training.incorrectPractice,
        ppe: training.requiredPpe
      }),
      category: training.categoryLabel
    });
    setOpenTrainingId("");
    setShowUploadForm(true);
    // Give the form a frame to mount before scrolling to it.
    requestAnimationFrame(() => {
      uploadFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const uploadTraining = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.title || !form.description || !form.category) {
      const message = "Training title, description and category are required.";
      setError(message);
      showValidationPopup(message);
      return;
    }
    if (form.requiresAssessment && !String(form.passingScore || "").trim()) {
      const message = "Enter the passing score, or turn off the assessment requirement.";
      setError(message);
      showValidationPopup(message);
      return;
    }

    // Ref lock closes the window between the click and React committing the
    // disabled state, so a fast double-click cannot post twice.
    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploading(true);
    await showLoadingPopup("Publishing Training", "Uploading training content...");

    try {
      // passingScore/validityMonths are optional numeric fields on the backend
      // (z.coerce.number().optional()) — an empty string would coerce to NaN
      // and fail validation, so they are only included when actually set.
      // passingScore is additionally gated by the assessment checkbox, which is
      // what stops a training silently becoming assessment-gated (and therefore
      // blocking Generate Certificate) because a number was left in the field.
      const payload = { ...form, video };
      if (!payload.requiresAssessment || !String(payload.passingScore || "").trim()) {
        delete payload.passingScore;
      }
      delete payload.requiresAssessment;
      if (!String(payload.validityMonths || "").trim()) delete payload.validityMonths;
      if (!String(payload.durationMinutes || "").trim()) delete payload.durationMinutes;

      await trainingService.create(payload);

      setForm(initialForm);
      setVideo(null);
      if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
      setVideoPreview("");
      setShowUploadForm(false);
      closeLoadingPopup();
      await showSuccessPopup("Training Published Successfully");
      fetchTraining();
    } catch (submitError) {
      closeLoadingPopup();
      const message = submitError?.response?.data?.message || "Training upload failed. Please try again.";
      setError(message);
      showValidationPopup(message, "Unable to Publish Training");
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  };

  const deleteConcept = async (training) => {
    if (!canManageConcepts || !training?._id || training.isCatalogPreview) return;
    const confirmed = await showConfirmPopup({
      title: "Delete Training Concept?",
      text: `${training.title} will be removed from the training list.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      icon: "warning"
    });
    if (!confirmed) return;

    setDeletingId(training._id);
    setError("");
    try {
      await trainingService.remove(training._id);
      if (openTrainingId === training._id) setOpenTrainingId("");
      await showSuccessPopup("Training Concept Deleted");
      await fetchTraining();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || "Unable to delete training concept");
    } finally {
      setDeletingId("");
    }
  };

  /* ----------------------------------------------------------- render */

  const openState = openTraining ? stateFor(openTraining) : null;

  return (
    <div className="safety-bg-overlay safety-bg-training space-y-5">
      <PageHeader
        title="HSE Training"
        subtitle="Safety curriculum, instructional media, assessments, and certificates"
        statusCount={publishedTrainings.length}
        actions={
          canManageConcepts ? (
            <ActionButton
              icon={showUploadForm ? undefined : Plus}
              variant={showUploadForm ? "secondary" : "primary"}
              size="sm"
              onClick={() => setShowUploadForm((value) => !value)}
            >
              {showUploadForm ? "Hide Upload Form" : "Add Training"}
            </ActionButton>
          ) : null
        }
      />

      {/* --------------------------------------------------- KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EnterpriseCard title="Published Training" icon={BookOpen} kpi={publishedTrainings.length} tone="raised" />
        <EnterpriseCard title="Completed by Me" icon={CheckCircle2} kpi={completionStats.completed} tone="raised" delay={0.04} />
        <EnterpriseCard
          title="Training Completion"
          icon={GraduationCap}
          kpi={`${completionStats.percent}%`}
          kpiHint={`${completionStats.completed} of ${completionStats.total}`}
          tone="raised"
          delay={0.08}
        />
        <EnterpriseCard title="My Certificates" icon={Award} kpi={completionStats.certificates} tone="raised" delay={0.12} />
      </div>

      {/* ------------------------------------------------ filter bar */}
      <EnterpriseCard bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {categoryFilters.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveCategory(category.key)}
              aria-pressed={activeCategory === category.key}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold transition ${
                activeCategory === category.key
                  ? "border border-[var(--brand-primary-light)] bg-[rgba(var(--brand-primary-rgb),.22)] text-white"
                  : "border border-white/12 bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]"
              }`}
            >
              {category.label}
              <span className="rounded-full bg-black/35 px-1.5 py-0.5 text-[10px]">{category.count}</span>
            </button>
          ))}

          <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search training concepts..."
              aria-label="Search training"
              className="min-h-9 w-full rounded-xl border border-white/12 bg-white/[0.05] py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-[var(--brand-primary-light)] focus:outline-none"
            />
          </div>
        </div>
      </EnterpriseCard>

      {/* ------------------------------------------------ upload form */}
      {canManageConcepts && showUploadForm ? (
        <EnterpriseCard
          ref={uploadFormRef}
          title="Publish a training concept"
          subtitle="Fields left blank fall back to the standard HSE curriculum content for this concept."
          icon={Upload}
        >
          <form className="grid grid-cols-1 gap-3 lg:grid-cols-2" onSubmit={uploadTraining}>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Training title *</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Category *</span>
              <input
                list="hse-training-categories"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                required
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
              <datalist id="hse-training-categories">
                {CATEGORIES.map((category) => (
                  <option key={category.key} value={category.label} />
                ))}
              </datalist>
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Description *</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                required
                className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs text-white"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">
                Safety objective
              </span>
              <textarea
                rows={2}
                value={form.objective}
                onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
                placeholder="What the learner must be able to do after this training"
                className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">
                Training concept (shown on certificates)
              </span>
              <input
                value={form.concept}
                onChange={(event) => setForm((prev) => ({ ...prev, concept: event.target.value }))}
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Trainer name</span>
              <input
                value={form.trainerName}
                onChange={(event) => setForm((prev) => ({ ...prev, trainerName: event.target.value }))}
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Duration (minutes)</span>
              <input
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">
                Certificate validity (months)
              </span>
              <input
                type="number"
                min="1"
                value={form.validityMonths}
                onChange={(event) => setForm((prev) => ({ ...prev, validityMonths: event.target.value }))}
                className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
              />
            </label>

            <label className="flex items-start gap-2.5 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-3 text-xs text-slate-200 lg:col-span-2">
              <input
                type="checkbox"
                checked={form.requiresAssessment}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    requiresAssessment: event.target.checked,
                    passingScore: event.target.checked ? prev.passingScore : ""
                  }))
                }
                className="mt-0.5"
              />
              <span>
                This training requires a passing assessment score before a certificate can be issued.
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  Leave unticked for awareness training — the certificate then reads &ldquo;Assessment: Not
                  Applicable&rdquo;.
                </span>
              </span>
            </label>

            {form.requiresAssessment ? (
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Passing score % *</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.passingScore}
                  onChange={(event) => setForm((prev) => ({ ...prev, passingScore: event.target.value }))}
                  required
                  className="min-h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-xs text-white"
                />
              </label>
            ) : null}

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Training video</span>
              <input
                type="file"
                accept="video/*"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setVideo(selected);
                  if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
                  setVideoPreview(selected ? URL.createObjectURL(selected) : "");
                }}
                className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.05] px-3 py-2.5 text-xs text-slate-300"
              />
            </label>

            {videoPreview ? (
              <video
                src={videoPreview}
                controls
                preload="metadata"
                className="h-40 w-full rounded-xl border border-white/10 object-cover lg:col-span-2"
              />
            ) : null}

            {form.hazards.length || form.correctPractice.length ? (
              <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-[11px] text-emerald-100 lg:col-span-2">
                Standard curriculum content for this concept ({form.hazards.length} hazards,{" "}
                {form.correctPractice.length} correct practices, {form.incorrectPractice.length} unsafe practices,{" "}
                {form.requiredPpe.length} PPE items) will be published with this training.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-100 lg:col-span-2">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 lg:col-span-2">
              <ActionButton
                type="submit"
                loading={uploading}
                loadingLabel="Publishing..."
                icon={Upload}
                className="flex-1"
              >
                Publish Training
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => {
                  setForm(initialForm);
                  setError("");
                }}
              >
                Reset
              </ActionButton>
            </div>
          </form>
        </EnterpriseCard>
      ) : null}

      {/* ------------------------------------------------- catalogue */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-white">
            {activeCategory === "all"
              ? "Training catalogue"
              : categoryFilters.find((entry) => entry.key === activeCategory)?.label}
          </h2>
          <p className="text-[11px] text-slate-400">
            {filteredTrainings.length} concept{filteredTrainings.length === 1 ? "" : "s"}
            {catalogPreviews.length ? ` · ${catalogPreviews.length} not yet published` : ""}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <CardSkeleton key={index} className="h-72" />
            ))}
          </div>
        ) : filteredTrainings.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No training matches these filters"
            message={
              search
                ? `Nothing matches "${search}". Clear the search or pick another category.`
                : "No training has been published for this category yet."
            }
            action={
              search || activeCategory !== "all" ? (
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("all");
                  }}
                >
                  Clear filters
                </ActionButton>
              ) : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredTrainings.map((training, index) => {
              const state = stateFor(training);
              return (
                <div key={training._id} className="relative">
                  {training.isCatalogPreview ? (
                    <span className="absolute -top-2 left-3 z-10 rounded-full border border-amber-400/40 bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      Not published
                    </span>
                  ) : null}
                  <TrainingCard
                    training={training}
                    index={index}
                    progress={state.progress}
                    status={state.status}
                    assessmentScore={state.assessmentScore}
                    passingScore={training.passingScore}
                    certificate={state.certificate}
                    deletable={canManageConcepts && !training.isCatalogPreview}
                    deleting={deletingId === training._id}
                    onDelete={(event) => {
                      event.stopPropagation();
                      deleteConcept(training);
                    }}
                    onOpen={() =>
                      training.isCatalogPreview
                        ? prefillFromCatalog(training)
                        : setOpenTrainingId(training._id)
                    }
                    onViewCertificate={() =>
                      state.certificate &&
                      runCertificateAction(
                        state.certificate,
                        "view",
                        viewCertificatePdf,
                        "Could not open the certificate PDF. Please try again."
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        {pagination?.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <ActionButton
              variant="secondary"
              loading={loadingMore}
              loadingLabel="Loading..."
              onClick={() => fetchTraining({ page: pagination.page + 1, append: true })}
            >
              {`Load More (${records.length} of ${pagination.total})`}
            </ActionButton>
          </div>
        ) : null}
      </section>

      {/* --------------------------------- completion & certificates */}
      <EnterpriseCard
        title="Training Completion &amp; Certificates"
        subtitle="A certificate can be generated once a training reaches 100% and meets any configured passing score. Every certificate carries a unique reference number and a verification code checkable on the public verify page."
        icon={Award}
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <CardSkeleton key={index} className="h-20" />
            ))}
          </div>
        ) : myCompletions.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No training started yet"
            message="Open any training concept above to begin. Your progress and certificates will appear here."
          />
        ) : (
          <div className="space-y-2">
            {myCompletions.map((item) => {
              const { certificate } = item;
              const certId = certificate?._id;
              // A training only ever needs a score when it has a passingScore
              // configured. Everything else, including every legacy record, is
              // never blocked on a missing score.
              const hasAssessment = item.passingScore !== null && item.passingScore !== undefined;
              const scorePending =
                hasAssessment && (item.assessmentScore === null || item.assessmentScore === undefined);
              const canGenerate = item.status === "completed" && !certificate && !scorePending;

              let assessmentLine = "Assessment: Not Applicable";
              if (hasAssessment) {
                assessmentLine = scorePending
                  ? `Assessment: Pending (passing score ${item.passingScore}%)`
                  : `Assessment: ${item.assessmentScore}% (passing ${item.passingScore}%)`;
              }

              return (
                <div
                  key={item.trainingId || item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <StatusBadge status={STATUS_LABELS[item.status] || "Assigned"} />
                      <span>{item.progress || 0}% complete</span>
                      <span>{assessmentLine}</span>
                      {certificate ? (
                        <span>
                          {certificate.certificateNumber} — completed {formatDateTime(certificate.completedAt)}
                        </span>
                      ) : null}
                    </div>
                    {item.status === "failed" ? (
                      <p className="mt-1.5 text-[11px] text-rose-300">
                        Certificate cannot be issued because the assessment score is below the passing requirement.
                      </p>
                    ) : null}
                    {scorePending ? (
                      <p className="mt-1.5 text-[11px] text-amber-200">
                        {canManageConcepts
                          ? "An assessment is configured for this training, but no score is available yet."
                          : "An assessment is configured for this training — your trainer needs to record a score before a certificate can be issued."}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {scorePending && canManageConcepts ? (
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        loading={busyAction === busyKey(item.trainingId, "score")}
                        loadingLabel="Saving..."
                        onClick={() => recordAssessmentScore(item)}
                      >
                        Record Score
                      </ActionButton>
                    ) : null}

                    {canGenerate ? (
                      <ActionButton
                        size="sm"
                        icon={ShieldCheck}
                        loading={busyAction === busyKey(item.trainingId, "generate")}
                        loadingLabel="Generating..."
                        onClick={() => generateCertificate(item)}
                      >
                        Generate Certificate
                      </ActionButton>
                    ) : null}

                    {certificate ? (
                      <>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          loading={busyAction === busyKey(certId, "view")}
                          loadingLabel="Opening..."
                          onClick={() =>
                            runCertificateAction(
                              certificate,
                              "view",
                              viewCertificatePdf,
                              "Could not open the certificate PDF. Please try again."
                            )
                          }
                        >
                          View
                        </ActionButton>
                        <ActionButton
                          size="sm"
                          icon={Download}
                          loading={busyAction === busyKey(certId, "download")}
                          loadingLabel="Preparing..."
                          onClick={() =>
                            runCertificateAction(
                              certificate,
                              "download",
                              downloadCertificatePdf,
                              "Could not generate the certificate PDF. Please try again."
                            )
                          }
                        >
                          Download
                        </ActionButton>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          icon={Printer}
                          loading={busyAction === busyKey(certId, "print")}
                          loadingLabel="Preparing..."
                          onClick={() =>
                            runCertificateAction(
                              certificate,
                              "print",
                              printCertificatePdf,
                              "Could not open the certificate for printing. Please try again."
                            )
                          }
                        >
                          Print
                        </ActionButton>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => openVerifyPage(certificate)}
                        >
                          Verify
                        </ActionButton>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </EnterpriseCard>

      {/* ---------------------------------------------- detail modal */}
      <AnimatePresence>
        {openTraining && openState ? (
          <TrainingDetail
            training={openTraining}
            progress={openState.progress}
            status={openState.status}
            assessmentScore={openState.assessmentScore}
            certificate={openState.certificate}
            canRecordScore={canManageConcepts}
            busyAction={
              busyAction === busyKey(openTraining._id, "generate")
                ? "generate"
                : busyAction === busyKey(openTraining._id, "score")
                ? "score"
                : ""
            }
            onClose={() => setOpenTrainingId("")}
            onProgress={(progress) => updateProgress(openTraining, progress)}
            onGenerateCertificate={() =>
              generateCertificate({
                trainingId: openTraining._id,
                title: openTraining.title,
                passingScore: openTraining.passingScore
              })
            }
            onRecordScore={() =>
              recordAssessmentScore({
                trainingId: openTraining._id,
                title: openTraining.title,
                passingScore: openTraining.passingScore
              })
            }
            onViewCertificate={() =>
              openState.certificate &&
              runCertificateAction(
                openState.certificate,
                "view",
                viewCertificatePdf,
                "Could not open the certificate PDF. Please try again."
              )
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default TrainingPage;
