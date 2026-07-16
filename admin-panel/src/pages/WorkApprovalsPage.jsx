import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Eye, ImagePlus, Pencil, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import GlassCard from "../components/common/GlassCard";
import SectionHeader from "../components/common/SectionHeader";
import MediaStudioModal from "../components/common/MediaStudioModal";
import SafeChartContainer from "../components/common/SafeChartContainer";
import ErrorBoundary from "../components/common/ErrorBoundary";
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
import {
  formatChainageRange,
  getChainageFrom,
  getChainageTo,
  matchesChainageSearch,
  validateChainageRange
} from "../utils/chainage";
import { checkedByUsers, recommendedByUsers, statusColors, workTypes } from "../config/workApprovalConfig";

const WORK_FORM_COLLAPSED_KEY = "workFormCollapsed";
const LEGACY_WORK_FORM_COLLAPSED_KEY = "workApprovalFormCollapsed";
const WORK_FILTERS_VISIBLE_KEY = "workFiltersVisible";
const WORKFLOW_STAGES = [
  "Pending Check",
  "Pending Recommendation",
  "Pending Approval",
  "Approved",
  "Completed",
  "Returned for Correction"
];
const getWorkflowStage = (work = {}) => {
  const status = work.workflowStage || work.status || "";
  if (WORKFLOW_STAGES.includes(status)) return status;
  if (status === "Pending" || status === "Under Review" || !status) return "Pending Check";
  if (status === "Rejected") return "Returned for Correction";
  return status;
};
const getRequiredAction = (work = {}) => ({
  "Pending Check": "Awaiting Check",
  "Pending Recommendation": "Awaiting Recommendation",
  "Pending Approval": "Awaiting Final Approval",
  Approved: "Awaiting Completion",
  Completed: "Completed",
  "Returned for Correction": "Returned for Correction"
}[getWorkflowStage(work)] || "Awaiting Review");

const getApiErrorMessage = (error, fallback = "Request failed") => {
  const data = error?.response?.data;
  const issues = data?.details?.issues || data?.errors?.issues || [];
  const issueMessages = Array.isArray(issues)
    ? issues
        .map((issue) => {
          const field = issue?.path ? `${issue.path}: ` : "";
          return issue?.message ? `${field}${issue.message}` : "";
        })
        .filter(Boolean)
        .join(" ")
    : "";
  const fieldErrors =
    data?.details?.fieldErrors ||
    data?.details ||
    data?.errors?.fieldErrors ||
    data?.errors ||
    {};
  const flattenedErrors = Object.values(fieldErrors)
    .flat()
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.message) return item.message;
      return "";
    })
    .filter(Boolean)
    .join(" ");

  return issueMessages || flattenedErrors || data?.message || error?.message || fallback;
};

const getWorkSubmitValidationMessage = ({ form, chainageValidation, beforeImages }) => {
  const missing = [];

  if (!form.workType) missing.push("Work Type");
  if (!form.location) missing.push("Location");
  if (!form.workersCount) missing.push("Workers Count");
  if (!form.description.trim()) missing.push("Work Description");
  if (!beforeImages.length) missing.push("Before Image");

  const chainageMessages = Object.values(chainageValidation.errors).filter(Boolean);
  if (chainageMessages.length) {
    missing.push(...chainageMessages);
  }

  return missing.length
    ? `Please complete: ${missing.join(", ")}.`
    : "Please fill all required Work Approval fields.";
};

const initialForm = {
  title: "",
  workType: "",
  category: "General",
  location: "",
  chainageFrom: "",
  chainageTo: "",
  workersCount: "",
  description: "",
  priority: "Medium",
  assignedTo: "",
  startDate: "",
  dueDate: ""
};

const getWorkRecordId = (work = {}) => work._id || work.id || work.workId || "";
const normalizeStatus = (status = "Pending") => String(status || "Pending").toLowerCase();
const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};
const formatElapsedDuration = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
};
const getWorkStatusSinceText = (work = {}) => {
  const status = getWorkflowStage(work);
  const lowerStatus = normalizeStatus(status);
  const timeline = Array.isArray(work.timeline) ? work.timeline : [];
  const statusEvent = [...timeline]
    .reverse()
    .find((item) => `${item?.label || ""} ${item?.description || ""}`.toLowerCase().includes(lowerStatus));
  const createdAt = work.createdAt || work.date;
  const changedAt =
    lowerStatus === "pending"
      ? createdAt
      : statusEvent?.at || work.updatedAt || createdAt;
  return `${status} since ${formatElapsedDuration(changedAt)}`;
};
const getStageBadgeClass = (stage = "Pending Check") => ({
  "Pending Check": "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  "Pending Recommendation": "border-violet-400/30 bg-violet-500/10 text-violet-100",
  "Pending Approval": "border-amber-400/30 bg-amber-500/10 text-amber-100",
  Approved: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  Completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  "Returned for Correction": "border-rose-400/30 bg-rose-500/10 text-rose-100"
}[stage] || statusColors.Pending.badge);
const getWorkReporterName = (work = {}) =>
  work.createdByName || work.reportedBy || work.createdBy?.name || work.submittedBy?.name || "";
const getApprovedByName = (work = {}) => work.approvedByName || work.approvedBy || "";
const getInitialFormCollapsed = () =>
  typeof window !== "undefined" &&
  (localStorage.getItem(WORK_FORM_COLLAPSED_KEY) ?? localStorage.getItem(LEGACY_WORK_FORM_COLLAPSED_KEY)) === "true";
const getInitialFiltersVisible = () =>
  typeof window !== "undefined" && localStorage.getItem(WORK_FILTERS_VISIBLE_KEY) === "true";
const MEDIA_IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const MEDIA_VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;
const isVideoUpload = (file) => file?.type?.startsWith("video/");
const isVideoUrl = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);
const splitWorkMediaSelection = (fileList = []) => {
  const images = [];
  const videos = [];
  const errors = [];

  Array.from(fileList).forEach((file) => {
    if (isVideoUpload(file)) {
      if (file.size > MEDIA_VIDEO_LIMIT_BYTES) {
        errors.push(`${file.name} exceeds 100MB video limit`);
      } else if (videos.length < 10) {
        videos.push(file);
      }
      return;
    }

    if (file.type?.startsWith("image/")) {
      if (file.size > MEDIA_IMAGE_LIMIT_BYTES) {
        errors.push(`${file.name} exceeds 10MB image limit`);
      } else if (images.length < 10) {
        images.push(file);
      }
      return;
    }

    errors.push(`${file.name} is not a supported image/video file`);
  });

  if (Array.from(fileList).filter((file) => file.type?.startsWith("image/")).length > 10) {
    errors.push("Maximum 10 images are allowed");
  }
  if (Array.from(fileList).filter((file) => file.type?.startsWith("video/")).length > 10) {
    errors.push("Maximum 10 videos are allowed");
  }

  return { images, videos, errors };
};
const WorkApprovalsPage = ({ user }) => {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [beforeImages, setBeforeImages] = useState([]);
  const [beforeVideos, setBeforeVideos] = useState([]);
  const [beforePreview, setBeforePreview] = useState("");
  const [modal, setModal] = useState({ open: false, items: [], index: 0, compare: null });
  const [selectedWork, setSelectedWork] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [listFilters, setListFilters] = useState({
    dateFrom: "",
    dateTo: "",
    createdBy: "",
    approvedBy: "",
    checkedBy: "",
    recommendedBy: "",
    workType: "",
    location: "",
    chainage: ""
  });
  const [formCollapsed, setFormCollapsed] = useState(getInitialFormCollapsed);
  const [filtersVisible, setFiltersVisible] = useState(getInitialFiltersVisible);
  const [chainageErrors, setChainageErrors] = useState({ chainageFrom: "", chainageTo: "" });
  const [editChainageErrors, setEditChainageErrors] = useState({ chainageFrom: "", chainageTo: "" });
  const [submitting, setSubmitting] = useState(false);
  const [busyWorkId, setBusyWorkId] = useState("");
  const [editingWork, setEditingWork] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editSaving, setEditSaving] = useState(false);
  const submitLockRef = useRef(false);
  const workActionLockRef = useRef(false);
  const editLockRef = useRef(false);

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

  useEffect(() => {
    localStorage.setItem(WORK_FORM_COLLAPSED_KEY, String(formCollapsed));
  }, [formCollapsed]);

  useEffect(() => {
    localStorage.setItem(WORK_FILTERS_VISIBLE_KEY, String(filtersVisible));
  }, [filtersVisible]);

  const submitWork = async (event) => {
    event.preventDefault();
    setError("");
    const chainageValidation = validateChainageRange(form);
    setChainageErrors(chainageValidation.errors);

    if (
      !form.workType ||
      !form.location ||
      !chainageValidation.isValid ||
      !form.workersCount ||
      !form.description.trim() ||
      beforeImages.length === 0
    ) {
      const validationMessage = getWorkSubmitValidationMessage({
        form,
        chainageValidation,
        beforeImages
      });
      setError(validationMessage);
      showValidationPopup(validationMessage);
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    await showLoadingPopup("Uploading Please Wait...", "Submitting work approval...");

    let uploadErrorMessage = "";
    try {
      await workService.create({
        ...form,
        ...chainageValidation.values,
        chainage: chainageValidation.values.chainageFrom,
        chainageNo: chainageValidation.values.chainageFrom,
        title: form.title || `${form.workType} - ${form.location}`,
        workersCount: Number(form.workersCount),
        beforeImages,
        beforeVideos
      });
      setForm(initialForm);
      setChainageErrors({ chainageFrom: "", chainageTo: "" });
      setBeforeImages([]);
      setBeforeVideos([]);
      if (beforePreview?.startsWith("blob:")) URL.revokeObjectURL(beforePreview);
      setBeforePreview("");
      await showSuccessPopup("Work Approval Submitted Successfully");
      fetchAll();
    } catch (submitError) {
      uploadErrorMessage = getApiErrorMessage(submitError, "Failed to submit work approval.");
      setError(uploadErrorMessage);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      await closeLoadingPopup();
    }

    if (uploadErrorMessage) {
      await showValidationPopup(uploadErrorMessage, "Work approval not submitted");
    }
  };

  const runStageAction = async (work, action, description) => {
    const id = getWorkRecordId(work);
    if (!id) {
      showValidationPopup("Unable to update this work record because its id is missing.");
      return;
    }
    if (getWorkflowStage(work) === "Completed") {
      showValidationPopup("Completed work is locked and cannot be changed.");
      return;
    }
    const cleanDescription = String(description || "").trim();
    if (!cleanDescription) {
      showValidationPopup("Please enter the mandatory workflow description.");
      return;
    }
    const actionConfig = {
      check: {
        label: "Check Work",
        confirmText: "Confirm that you have reviewed the work details and media evidence.",
        service: () => workService.check(id, cleanDescription),
        success: "Work Checked Successfully"
      },
      recommend: {
        label: "Recommend Work",
        confirmText: "Confirm that you recommend this work for final approval.",
        service: () => workService.recommend(id, cleanDescription),
        success: "Work Recommended Successfully"
      },
      approve: {
        label: "Final Approval",
        confirmText: "Confirm final approval of this work.",
        service: () => workService.approve(id, cleanDescription),
        success: "Work Approved Successfully"
      },
      return: {
        label: "Return for Correction",
        confirmText: "Return this work approval to the creator for correction?",
        service: () => workService.returnForCorrection(id, cleanDescription),
        success: "Work Returned for Correction"
      }
    }[action];
    if (!actionConfig) return;
    const confirmed = await showConfirmPopup({
      title: actionConfig.label,
      text: actionConfig.confirmText,
      confirmText: actionConfig.label,
      cancelText: "Cancel",
      icon: action === "return" ? "warning" : "question"
    });
    if (!confirmed) return;
    if (workActionLockRef.current) return;
    workActionLockRef.current = true;
    setBusyWorkId(id);
    await showLoadingPopup("Uploading Please Wait...", `${actionConfig.label} in progress...`);
    let statusErrorMessage = "";
    try {
      const response = await actionConfig.service();
      const updatedWork = response.work;
      setRecords((prev) => prev.map((item) => (getWorkRecordId(item) === id ? updatedWork : item)));
      setSelectedWork((prev) => (prev && getWorkRecordId(prev) === id ? updatedWork : prev));
      await showSuccessPopup(actionConfig.success);
      fetchAll();
    } catch (statusError) {
      statusErrorMessage = getApiErrorMessage(statusError, "Workflow action failed");
      setError(statusErrorMessage);
    } finally {
      workActionLockRef.current = false;
      setBusyWorkId("");
      await closeLoadingPopup();
    }

    if (statusErrorMessage) {
      await showValidationPopup(statusErrorMessage, "Workflow update failed");
    }
  };

  const completeWork = async (work, files, description) => {
    const id = getWorkRecordId(work);
    if (!id) {
      showValidationPopup("Unable to complete this work record because its id is missing.");
      return;
    }
    if (getWorkflowStage(work) === "Completed") {
      showValidationPopup("Completed work is already locked.");
      return;
    }
    const cleanDescription = String(description || "").trim();
    if (!cleanDescription) {
      showValidationPopup("Please enter the completion description.");
      return;
    }
    if (!files.length) {
      setError("Upload completion evidence");
      showValidationPopup("Please upload a completion image or video before marking work completed.");
      return;
    }
    const confirmed = await showConfirmPopup({
      title: "Complete Work",
      text: "Confirm that completion media is uploaded and the work can be marked completed.",
      confirmText: "Mark Completed",
      cancelText: "Cancel",
      icon: "question"
    });
    if (!confirmed) return;
    if (workActionLockRef.current) return;
    workActionLockRef.current = true;
    setBusyWorkId(id);
    await showLoadingPopup("Uploading Please Wait...", "Uploading completion evidence...");
    let uploadErrorMessage = "";
    try {
      const response = await workService.uploadAfterImages(id, files, cleanDescription);
      const updatedWork = response.work;
      setRecords((prev) => prev.map((item) => (getWorkRecordId(item) === id ? updatedWork : item)));
      setSelectedWork((prev) => (prev && getWorkRecordId(prev) === id ? updatedWork : prev));
      await showSuccessPopup("Work Marked Completed Successfully");
      fetchAll();
    } catch (uploadError) {
      uploadErrorMessage = getApiErrorMessage(uploadError, "Image upload failed");
      setError(uploadErrorMessage);
    } finally {
      workActionLockRef.current = false;
      setBusyWorkId("");
      await closeLoadingPopup();
    }

    if (uploadErrorMessage) {
      await showValidationPopup(uploadErrorMessage, "Completion upload failed");
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

  const openEditWork = (work) => {
    setEditingWork(work);
    setEditChainageErrors({ chainageFrom: "", chainageTo: "" });
    setEditForm({
      title: work.title || "",
      workType: work.workType || "",
      category: work.category || "General",
      location: work.location || "",
      chainageFrom: getChainageFrom(work),
      chainageTo: getChainageTo(work),
      workersCount: work.workersCount ? String(work.workersCount) : "",
      description: work.description || work.workDescription || "",
      priority: work.priority || "Medium",
      assignedTo: "",
      startDate: toDateInputValue(work.startDate),
      dueDate: toDateInputValue(work.dueDate)
    });
  };

  const saveWorkEdit = async (event) => {
    event.preventDefault();
    const id = getWorkRecordId(editingWork);
    const chainageValidation = validateChainageRange(editForm);
    setEditChainageErrors(chainageValidation.errors);

    if (!id) {
      showValidationPopup("Unable to edit this work record because its id is missing.");
      return;
    }
    if (
      !editForm.workType ||
      !editForm.location ||
      !chainageValidation.isValid ||
      !editForm.workersCount ||
      !editForm.description.trim()
    ) {
      showValidationPopup("Please fill all required Work Approval edit fields.");
      return;
    }
    if (editLockRef.current) return;

    editLockRef.current = true;
    setEditSaving(true);
    await showLoadingPopup("Uploading Please Wait...", "Saving work approval corrections...");
    try {
      const response = await workService.update(id, {
        title: editForm.title,
        workType: editForm.workType,
        category: editForm.category,
        location: editForm.location,
        ...chainageValidation.values,
        chainage: chainageValidation.values.chainageFrom,
        chainageNo: chainageValidation.values.chainageFrom,
        workersCount: Number(editForm.workersCount),
        description: editForm.description.trim(),
        priority: editForm.priority,
        startDate: editForm.startDate,
        dueDate: editForm.dueDate
      });
      const updatedWork = response.work;
      setRecords((prev) =>
        prev.map((item) => (getWorkRecordId(item) === id ? updatedWork : item))
      );
      setSelectedWork((prev) => (prev && getWorkRecordId(prev) === id ? updatedWork : prev));
      setEditingWork(null);
      await showSuccessPopup("Work Approval Updated Successfully");
      fetchAll();
    } catch (editError) {
      const message = editError?.response?.data?.message || editError?.message || "Work edit failed";
      setError(message);
      showValidationPopup(message);
    } finally {
      editLockRef.current = false;
      setEditSaving(false);
      closeLoadingPopup();
    }
  };

  const openGallery = (work, startAt = 0) => {
    const before = (work.beforeImages?.length ? work.beforeImages : work.beforeImage ? [work.beforeImage] : [])
      .map((item) => ({ url: getMediaUrl(item), title: "Before Work" }))
      .filter((item) => Boolean(item.url));
    const after = (work.afterImages?.length ? work.afterImages : work.afterImage ? [work.afterImage] : [])
      .map((item) => ({ url: getMediaUrl(item), title: "After Work" }))
      .filter((item) => Boolean(item.url));
    const beforeVideos = (work.beforeVideos?.length ? work.beforeVideos : work.beforeVideo ? [work.beforeVideo] : [])
      .map((item) => ({ url: getMediaUrl(item), title: "Before Work Video" }))
      .filter((item) => Boolean(item.url));
    const afterVideos = (work.afterVideos?.length ? work.afterVideos : work.afterVideo ? [work.afterVideo] : [])
      .map((item) => ({ url: getMediaUrl(item), title: "After Work Video" }))
      .filter((item) => Boolean(item.url));
    const combined = [...before, ...beforeVideos, ...after, ...afterVideos];
    setModal({
      open: true,
      items: combined,
      index: Math.min(Math.max(startAt, 0), Math.max(0, combined.length - 1)),
      compare: null
    });
  };

  const filteredRecords = useMemo(() => {
    const createdByNeedle = listFilters.createdBy.trim().toLowerCase();
    const approvedByNeedle = listFilters.approvedBy.trim().toLowerCase();
    const checkedByNeedle = listFilters.checkedBy.trim().toLowerCase();
    const recommendedByNeedle = listFilters.recommendedBy.trim().toLowerCase();
    const locationNeedle = listFilters.location.trim().toLowerCase();
    const fromDate = listFilters.dateFrom ? new Date(listFilters.dateFrom) : null;
    const toDate = listFilters.dateTo ? new Date(listFilters.dateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return records.filter((item) => {
      const createdAt = new Date(item.createdAt || item.date || "");
      const itemStage = getWorkflowStage(item);
      const statusMatch = statusFilter === "All" || itemStage === statusFilter || (item.status || "") === statusFilter;
      const dateMatch =
        (!fromDate || (!Number.isNaN(createdAt.getTime()) && createdAt >= fromDate)) &&
        (!toDate || (!Number.isNaN(createdAt.getTime()) && createdAt <= toDate));
      const createdByMatch =
        !createdByNeedle || getWorkReporterName(item).toLowerCase().includes(createdByNeedle);
      const approvedByMatch =
        !approvedByNeedle || getApprovedByName(item).toLowerCase().includes(approvedByNeedle);
      const checkedByMatch =
        !checkedByNeedle || String(item.checkedBy || "").toLowerCase().includes(checkedByNeedle);
      const recommendedByMatch =
        !recommendedByNeedle || String(item.recommendedBy || "").toLowerCase().includes(recommendedByNeedle);
      const locationMatch =
        !locationNeedle || String(item.location || "").toLowerCase().includes(locationNeedle);
      const workTypeMatch = !listFilters.workType || (item.workType || item.title || "") === listFilters.workType;
      const chainageMatch = matchesChainageSearch(item, listFilters.chainage);
      return (
        statusMatch &&
        dateMatch &&
        createdByMatch &&
        approvedByMatch &&
        checkedByMatch &&
        recommendedByMatch &&
        locationMatch &&
        workTypeMatch &&
        chainageMatch
      );
    });
  }, [records, statusFilter, listFilters]);

  const chartData = useMemo(
    () => [
      { name: "Approved", value: records.filter((item) => getWorkflowStage(item) === "Approved").length },
      {
        name: "Pending",
        value: records.filter((item) => getWorkflowStage(item).startsWith("Pending")).length
      },
      { name: "Completed", value: records.filter((item) => getWorkflowStage(item) === "Completed").length },
      { name: "Returned", value: records.filter((item) => getWorkflowStage(item) === "Returned for Correction").length }
    ],
    [records]
  );

  const stageCounts = useMemo(
    () =>
      WORKFLOW_STAGES.reduce((acc, stage) => {
        acc[stage] = records.filter((item) => getWorkflowStage(item) === stage).length;
        return acc;
      }, {}),
    [records]
  );

  const statusTone = (status) => {
    const stage = status || "Pending Check";
    const stageTone = {
      "Pending Check": "text-cyan-300",
      "Pending Recommendation": "text-violet-300",
      "Pending Approval": "text-amber-300",
      Approved: "text-emerald-300",
      Completed: "text-teal-300",
      "Returned for Correction": "text-rose-300"
    };
    return stageTone[stage] || statusColors[stage]?.text || statusColors.Pending.text;
  };

  return (
    <div className="safety-bg-overlay safety-bg-work space-y-5">
      <SectionHeader
        title="Work Approval Workflow"
        subtitle="Legacy fields restored with single-admin approval lifecycle and image evidence"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          {["Pending Check", "Pending Recommendation", "Pending Approval", "Approved"].map((stage) => (
            <span key={stage} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-slate-200">
              {stage}: <span className="text-cyan-200">{stageCounts[stage] || 0}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormCollapsed((prev) => !prev)}
            className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-[0_12px_30px_rgba(8,145,178,.14)] transition hover:border-cyan-200/60 hover:bg-cyan-500/20"
          >
            {formCollapsed ? "Show Form" : "Hide Form"}
          </button>
          <button
            type="button"
            onClick={() => setFiltersVisible((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-200/40 hover:bg-white/15"
          >
            <SlidersHorizontal size={14} />
            {filtersVisible ? "Hide Filters" : "Show Filters"}
          </button>
          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-500/20"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 xl:h-[calc(100vh-120px)] ${formCollapsed ? "xl:grid-cols-1" : "xl:grid-cols-3"}`}>
        <AnimatePresence initial={false}>
          {!formCollapsed ? (
            <motion.div
              key="work-submit-form"
              initial={{ opacity: 0, x: -24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.98 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="xl:col-span-1"
            >
        <GlassCard className="module-sticky-card p-5">
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
              {workTypes.map((item) => (
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-300">Chainage From</span>
                <input
                  placeholder="KM 326+500"
                  value={form.chainageFrom}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, chainageFrom: event.target.value }));
                    if (chainageErrors.chainageFrom) {
                      setChainageErrors((prev) => ({ ...prev, chainageFrom: "" }));
                    }
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
                {chainageErrors.chainageFrom ? (
                  <span className="mt-1 block text-[11px] text-rose-300">{chainageErrors.chainageFrom}</span>
                ) : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-300">Chainage To</span>
                <input
                  placeholder="KM 327+200"
                  value={form.chainageTo}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, chainageTo: event.target.value }));
                    if (chainageErrors.chainageTo) {
                      setChainageErrors((prev) => ({ ...prev, chainageTo: "" }));
                    }
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
                {chainageErrors.chainageTo ? (
                  <span className="mt-1 block text-[11px] text-rose-300">{chainageErrors.chainageTo}</span>
                ) : null}
              </label>
            </div>
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
              accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm"
              multiple
              onChange={(event) => {
                const { images, videos, errors } = splitWorkMediaSelection(event.target.files || []);
                if (errors.length) showValidationPopup(errors.join(". "));
                const selected = [...images, ...videos][0] || null;
                setBeforeImages(images);
                setBeforeVideos(videos);
                if (beforePreview?.startsWith("blob:")) URL.revokeObjectURL(beforePreview);
                setBeforePreview(selected ? URL.createObjectURL(selected) : "");
              }}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
            />
            {beforePreview ? (
              isVideoUpload([...beforeImages, ...beforeVideos][0]) ? (
                <video
                  src={beforePreview}
                  controls
                  className="h-28 w-full rounded-xl border border-white/10 object-contain"
                />
              ) : (
                <img
                  src={beforePreview}
                  alt="Before Work Preview"
                  className="h-28 w-full rounded-xl border border-white/10 object-contain"
                />
              )
            ) : null}
            {beforeImages.length || beforeVideos.length ? (
              <p className="text-[11px] text-slate-400">
                Selected: {beforeImages.length} image(s), {beforeVideos.length} video(s)
              </p>
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
            <SafeChartContainer height={250}>
              <ResponsiveContainer width="100%" height="100%">
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
            </SafeChartContainer>
          </div>
          {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </GlassCard>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <GlassCard className={`p-5 xl:max-h-[calc(100vh-120px)] xl:overflow-hidden ${formCollapsed ? "xl:col-span-1" : "xl:col-span-2"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Work List</h3>
              <p className="text-xs text-slate-400">
                Showing {filteredRecords.length} of {records.length} work approvals
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("All");
                setListFilters({
                  dateFrom: "",
                  dateTo: "",
                  createdBy: "",
                  approvedBy: "",
                  checkedBy: "",
                  recommendedBy: "",
                  workType: "",
                  location: "",
                  chainage: ""
                });
              }}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100"
            >
              Clear Filters
            </button>
          </div>
          <AnimatePresence initial={false}>
            {filtersVisible ? (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="sticky top-0 z-10 mb-4 grid grid-cols-1 gap-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur-xl md:grid-cols-2 xl:grid-cols-5"
              >
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              >
                {["All", ...WORKFLOW_STAGES].map((status) => (
                  <option key={status} value={status} className="bg-slate-900 text-white">
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Date From
              </span>
              <input
                type="date"
                value={listFilters.dateFrom}
                onChange={(event) => setListFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Date To
              </span>
              <input
                type="date"
                value={listFilters.dateTo}
                onChange={(event) => setListFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Created By
              </span>
              <input
                value={listFilters.createdBy}
                onChange={(event) => setListFilters((prev) => ({ ...prev, createdBy: event.target.value }))}
                placeholder="Search name"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Work Type
              </span>
              <select
                value={listFilters.workType}
                onChange={(event) => setListFilters((prev) => ({ ...prev, workType: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              >
                <option value="" className="bg-slate-900 text-white">
                  All Work Types
                </option>
                {workTypes.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Location
              </span>
              <input
                value={listFilters.location}
                onChange={(event) => setListFilters((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Search location"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Approved By
              </span>
              <input
                value={listFilters.approvedBy}
                onChange={(event) => setListFilters((prev) => ({ ...prev, approvedBy: event.target.value }))}
                placeholder="Admin name"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Checked By
              </span>
              <select
                value={listFilters.checkedBy}
                onChange={(event) => setListFilters((prev) => ({ ...prev, checkedBy: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              >
                <option value="" className="bg-slate-900 text-white">All</option>
                {checkedByUsers.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Recommended By
              </span>
              <select
                value={listFilters.recommendedBy}
                onChange={(event) => setListFilters((prev) => ({ ...prev, recommendedBy: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              >
                <option value="" className="bg-slate-900 text-white">All</option>
                {recommendedByUsers.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Chainage
              </span>
              <input
                value={listFilters.chainage}
                onChange={(event) => setListFilters((prev) => ({ ...prev, chainage: event.target.value }))}
                placeholder="KM 326+500"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {loading ? (
            <p className="text-sm text-slate-300">Loading work approvals...</p>
          ) : (
            <div className={`module-list-scroll space-y-4 xl:overflow-y-auto xl:pr-1 ${filtersVisible ? "xl:max-h-[calc(100vh-270px)]" : "xl:max-h-[calc(100vh-165px)]"}`}>
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
                const beforeVideoItems = (
                  work.beforeVideos?.length ? work.beforeVideos : work.beforeVideo ? [work.beforeVideo] : []
                )
                  .map((item) => ({ url: getMediaUrl(item), type: "video" }))
                  .filter((item) => Boolean(item.url));
                const afterVideoItems = (
                  work.afterVideos?.length ? work.afterVideos : work.afterVideo ? [work.afterVideo] : []
                )
                  .map((item) => ({ url: getMediaUrl(item), type: "video" }))
                  .filter((item) => Boolean(item.url));
                const beforeMediaItems = [...beforeItems, ...beforeVideoItems];
                const afterMediaItems = [...afterItems, ...afterVideoItems];
                const beforePreview = beforeMediaItems[0]?.url || "";
                const afterPreview = afterMediaItems[0]?.url || "";
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
                const workflowStage = getWorkflowStage(work);
                const workCompleted = workflowStage === "Completed";
                const statusSinceText = getWorkStatusSinceText(work);
                const actionRequired = getRequiredAction(work);

                return (
                  <div
                    key={recordId || work._id}
                    onClick={(event) => {
                      if (event.target.closest("button, input, select, a")) return;
                      setSelectedWork(work);
                    }}
                    className="cursor-pointer rounded-2xl border border-white/12 bg-white/5 p-4 transition duration-300 hover:border-cyan-300/30 hover:bg-white/[0.075] hover:shadow-[0_20px_50px_rgba(8,145,178,.12)]"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                      <span className={`text-xs font-semibold ${statusTone(work.status || "Pending")}`}>
                        {statusSinceText}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Last updated: {formatDateTime(work.updatedAt || work.createdAt)}
                      </span>
                    </div>
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
                            isVideoUrl(beforePreview) ? (
                              <video src={beforePreview} muted playsInline className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                            ) : (
                              <img src={beforePreview} alt="Before work" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                            )
                          ) : (
                            <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-500">No Image Available</span>
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{work.workType || work.title || "Work Approval"}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            {work.location || "-"} | {formatChainageRange(work, true)}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">Created By: {getWorkReporterName(work) || "-"}</p>
                          {work.checkedBy || work.recommendedBy ? (
                            <p className="mt-1 text-xs text-slate-400">
                              {work.checkedBy ? `Checked: ${work.checkedBy}` : ""}
                              {work.checkedBy && work.recommendedBy ? " | " : ""}
                              {work.recommendedBy ? `Recommended: ${work.recommendedBy}` : ""}
                            </p>
                          ) : null}
                          {getApprovedByName(work) ? (
                            <p className="mt-1 text-xs text-slate-400">
                              Approved By: {getApprovedByName(work)}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStageBadgeClass(workflowStage)}`}>
                              {workflowStage}
                            </span>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                              {actionRequired}
                            </span>
                            <span className="text-[11px] text-slate-400">Workers: {work.workersCount || "-"}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(work.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <motion.button
                          type="button"
                          onClick={() => setSelectedWork(work)}
                          whileHover={{ y: -2, scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-100"
                        >
                          <Eye size={13} />
                          View Details
                        </motion.button>
                        {canApprove ? (
                          <motion.button
                            type="button"
                            onClick={() => openEditWork(work)}
                            whileHover={{ y: -2, scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-100"
                          >
                            <Pencil size={13} />
                            Edit
                          </motion.button>
                        ) : null}
                        <motion.button
                          type="button"
                          onClick={() => openGallery(work, 0)}
                          whileHover={{ y: -2, scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white"
                        >
                          <ImagePlus size={13} />
                          Image Gallery
                        </motion.button>
                        {canDelete ? (
                          <motion.button
                            type="button"
                            onClick={() => deleteWork(work)}
                            whileHover={{ y: -2, scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-rose-100"
                          >
                            <Trash2 size={13} />
                            Delete
                          </motion.button>
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
                            {isVideoUrl(beforePreview) ? (
                              <video
                                src={beforePreview}
                                muted
                                playsInline
                                className="h-36 w-full object-contain transition duration-300 hover:scale-105"
                              />
                            ) : (
                              <img
                                src={beforePreview}
                                alt="Before Work"
                                loading="lazy"
                                className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                              />
                            )}
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
                              openGallery(work, Math.max(beforeMediaItems.length, 0));
                            }}
                            className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
                          >
                            {isVideoUrl(afterPreview) ? (
                              <video
                                src={afterPreview}
                                muted
                                playsInline
                                className="h-36 w-full object-contain transition duration-300 hover:scale-105"
                              />
                            ) : (
                              <img
                                src={afterPreview}
                                alt="After Work"
                                loading="lazy"
                                className="h-36 w-full object-cover transition duration-300 hover:scale-105"
                              />
                            )}
                          </button>
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-xs text-slate-400">
                            After image not uploaded
                          </div>
                        )}
                      </div>
                    </div>

                    {workCompleted ? (
                      <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                        Completed work is locked. Status cannot be changed.
                      </p>
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

      {editingWork ? (
        <div
          className="fixed inset-0 z-[99990] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
          onClick={() => setEditingWork(null)}
        >
          <form
            onSubmit={saveWorkEdit}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-3xl rounded-[28px] border border-white/12 bg-slate-950/95 p-5 shadow-[0_30px_90px_rgba(8,145,178,.22)]"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Correct Submitted Details
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">Edit Work Approval</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Images and approval status remain unchanged. A timeline entry will be added.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWork(null)}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs text-slate-300">Work Type</span>
                <select
                  value={editForm.workType}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, workType: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                >
                  <option value="" className="bg-slate-900 text-white">
                    Select Work Type
                  </option>
                  {workTypes.map((item) => (
                    <option key={item} value={item} className="bg-slate-900 text-white">
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Priority</span>
                <select
                  value={editForm.priority}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, priority: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  {["Low", "Medium", "High", "Critical"].map((item) => (
                    <option key={item} value={item} className="bg-slate-900 text-white">
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Location</span>
                <input
                  value={editForm.location}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Chainage From</span>
                <input
                  value={editForm.chainageFrom}
                  onChange={(event) => {
                    setEditForm((prev) => ({ ...prev, chainageFrom: event.target.value }));
                    if (editChainageErrors.chainageFrom) {
                      setEditChainageErrors((prev) => ({ ...prev, chainageFrom: "" }));
                    }
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
                {editChainageErrors.chainageFrom ? (
                  <span className="mt-1 block text-[11px] text-rose-300">{editChainageErrors.chainageFrom}</span>
                ) : null}
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Chainage To</span>
                <input
                  value={editForm.chainageTo}
                  onChange={(event) => {
                    setEditForm((prev) => ({ ...prev, chainageTo: event.target.value }));
                    if (editChainageErrors.chainageTo) {
                      setEditChainageErrors((prev) => ({ ...prev, chainageTo: "" }));
                    }
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
                {editChainageErrors.chainageTo ? (
                  <span className="mt-1 block text-[11px] text-rose-300">{editChainageErrors.chainageTo}</span>
                ) : null}
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Workers Count</span>
                <input
                  type="number"
                  min="1"
                  value={editForm.workersCount}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, workersCount: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-300">Title</span>
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Optional title"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs text-slate-300">Work Description</span>
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
                  required
                />
                <span className="mt-1 block text-right text-[10px] text-slate-500">
                  {editForm.description.length}/1000
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingWork(null)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ErrorBoundary
        resetKey={selectedWork?._id || selectedWork?.id || "work-details-closed"}
        fallback={null}
        onError={() => {
          setError("Unable to open this work approval. Refreshing the item data.");
          setSelectedWork(null);
          fetchAll();
        }}
      >
        <WorkApprovalDetailsModal
          open={Boolean(selectedWork)}
          work={selectedWork}
          user={user}
          busy={Boolean(selectedWork) && busyWorkId === getWorkRecordId(selectedWork)}
          onClose={() => setSelectedWork(null)}
          onOpenMedia={(items, index) =>
            setModal({ open: true, items, index, compare: null })
          }
          onStageAction={(action, description) => runStageAction(selectedWork, action, description)}
          onComplete={(files, description) => completeWork(selectedWork, files, description)}
        />
      </ErrorBoundary>

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
