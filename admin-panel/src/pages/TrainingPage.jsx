import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, HardHat, PlayCircle, Trash2 } from "lucide-react";
import GlassCard from "../components/common/GlassCard";
import MediaStudioModal from "../components/common/MediaStudioModal";
import PageHeader from "../components/common/PageHeader";
import { trainingService } from "../api/services";
import {
  closeLoadingPopup,
  showConfirmPopup,
  showLoadingPopup,
  showSuccessPopup,
  showValidationPopup
} from "../utils/alerts";
import { formatDateTime } from "../utils/format";
import { getMediaUrl, IMAGE_PLACEHOLDER_URL } from "../utils/media";

const baseCategories = ["All", "General", "PPE", "Electrical", "Fire Safety", "Road Safety"];

const createSafetyGallerySvg = ({ title, subtitle, accent }) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="58%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="1400" height="860" rx="54" fill="url(#bg)"/>
      <circle cx="1130" cy="165" r="132" fill="#ffffff" opacity=".08"/>
      <circle cx="245" cy="690" r="180" fill="#5eead4" opacity=".10"/>
      <path d="M208 592h356l-48 120H256z" fill="none" stroke="#facc15" stroke-width="18" stroke-linejoin="round"/>
      <path d="M260 592l38-210h176l38 210M302 438h168M322 500h130M306 560h164" fill="none" stroke="#facc15" stroke-width="16" stroke-linecap="round"/>
      <path d="M940 244l156 70v130c0 126-78 238-156 278-78-40-156-152-156-278V314z" fill="none" stroke="#5eead4" stroke-width="18" stroke-linejoin="round"/>
      <path d="M872 474l50 50 104-126" fill="none" stroke="#5eead4" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="104" y="145" fill="#f8fafc" font-family="Arial, sans-serif" font-size="62" font-weight="800">${title}</text>
      <text x="108" y="213" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="30">${subtitle}</text>
      <text x="108" y="278" fill="#67e8f9" font-family="Arial, sans-serif" font-size="22" letter-spacing="8">SAFETY AWARENESS</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const fallbackSafetyGallery = [
  createSafetyGallerySvg({
    title: "PPE Saves Lives",
    subtitle: "Helmet, vest, gloves, and eye protection before every task.",
    accent: "#083344"
  }),
  createSafetyGallerySvg({
    title: "Report Every Hazard",
    subtitle: "Observe, report, correct, and close unsafe conditions.",
    accent: "#431407"
  }),
  createSafetyGallerySvg({
    title: "Work Zone Discipline",
    subtitle: "Barricades, signage, and traffic controls protect every worker.",
    accent: "#172554"
  })
];

const loadLocalSafetyGallery = () => {
  try {
    // CRA/Webpack: load every image from src/assets/safety-gallery automatically.
    // eslint-disable-next-line no-undef
    const galleryContext = require.context("../assets/safety-gallery", false, /\.(png|jpe?g|webp|avif|gif|svg)$/i);
    return galleryContext
      .keys()
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((key) => galleryContext(key));
  } catch (_error) {
    return [];
  }
};

const safetyGallery = (() => {
  const localImages = loadLocalSafetyGallery();
  return localImages.length ? localImages : fallbackSafetyGallery;
})();

const initialForm = {
  title: "",
  description: "",
  category: ""
};

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");

const TrainingPage = ({ user }) => {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [activeTraining, setActiveTraining] = useState(null);
  const [playVideo, setPlayVideo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageModal, setImageModal] = useState({ open: false, items: [], index: 0, compare: null });
  const [deletingId, setDeletingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadLockRef = useRef(false);
  const previewVideoRef = useRef(null);

  const currentRole = normalizeRole(user?.role);
  const canManageConcepts = ["super_admin", "admin", "safety_manager"].includes(currentRole);
  const canUpload = canManageConcepts;

  const fetchTraining = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, historyRes, certRes] = await Promise.all([
        trainingService.list(),
        trainingService.history(),
        trainingService.certificates()
      ]);
      const list = listRes.records || [];
      setRecords(list);
      setHistory(historyRes.history || []);
      setCertificates(certRes.certificates || []);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load training modules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraining();
  }, [fetchTraining]);

  useEffect(() => {
    return () => {
      if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  useEffect(() => {
    const previewNode = previewVideoRef.current;
    const previewSource =
      videoPreview || getMediaUrl(activeTraining?.video?.url || activeTraining?.video);
    if (!previewNode || !previewSource) return;
    if (playVideo) {
      const playback = previewNode.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch(() => {});
      }
      return;
    }
    previewNode.pause();
    previewNode.currentTime = 0;
  }, [playVideo, videoPreview, activeTraining]);

  useEffect(() => {
    setPlayVideo(true);
  }, [activeTraining?._id]);

  const categoryOptions = useMemo(() => {
    const dynamic = new Set(baseCategories);
    records.forEach((item) => {
      if (item?.category) dynamic.add(item.category);
    });
    return Array.from(dynamic);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const searchKey = search.trim().toLowerCase();
    return records.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory) return false;
      if (!searchKey) return true;
      const payload = `${item.title || ""} ${item.description || ""} ${item.category || ""}`.toLowerCase();
      return payload.includes(searchKey);
    });
  }, [records, activeCategory, search]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setActiveTraining(null);
      return;
    }
    if (!activeTraining) {
      setActiveTraining(filteredRecords[0]);
      return;
    }
    const exists = filteredRecords.some((item) => item._id === activeTraining._id);
    if (!exists) setActiveTraining(filteredRecords[0]);
  }, [filteredRecords, activeTraining]);

  const userProgressMap = useMemo(() => {
    const map = new Map();
    history.forEach((item) => {
      map.set(item.id || item.trainingId, item.progress || 0);
    });
    return map;
  }, [history]);

  const updateProgress = async (record, progress, seconds = 120) => {
    if (!record?._id) return;
    try {
      await trainingService.updateProgress(record._id, progress, seconds);
      setHistory((prev) => {
        const next = [...prev];
        const idx = next.findIndex((item) => (item.id || item.trainingId) === record._id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], progress: Math.max(progress, next[idx].progress || 0) };
        } else {
          next.push({ id: record._id, progress });
        }
        return next;
      });
    } catch (_error) {
      // Legacy training endpoints may not support progress updates.
    }
  };

  const uploadTraining = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.title || !form.description || !form.category || !video) {
      setError("Fill all required training fields");
      showValidationPopup("Please fill all required Training fields.");
      return;
    }
    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploading(true);
    await showLoadingPopup("Uploading Please Wait...", "Uploading training video...");
    try {
      await trainingService.create({
        ...form,
        video
      });
      setForm(initialForm);
      setVideo(null);
      if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
      setVideoPreview("");
      await showSuccessPopup("Training Added Successfully");
      fetchTraining();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Training upload failed");
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
      closeLoadingPopup();
    }
  };

  const deleteConcept = async (record, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canManageConcepts || !record?._id) return;
    const confirmed = await showConfirmPopup({
      title: "Delete Training Concept?",
      text: `${record.title} will be removed from the training list.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      icon: "warning"
    });
    if (!confirmed) return;

    setDeletingId(record._id);
    setError("");
    try {
      await trainingService.remove(record._id);
      await showSuccessPopup("Training Concept Deleted");
      if (activeTraining?._id === record._id) {
        setPlayVideo(false);
      }
      await fetchTraining();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || "Unable to delete training concept");
    } finally {
      setDeletingId("");
    }
  };

  const activeVideoUrl = getMediaUrl(activeTraining?.video?.url || activeTraining?.video);
  const activeBannerUrl =
    getMediaUrl(activeTraining?.thumbnail?.url || activeTraining?.banner || activeTraining?.thumbnail) ||
    safetyGallery[0] ||
    IMAGE_PLACEHOLDER_URL;
  const effectivePreviewVideo = videoPreview || activeVideoUrl;

  const openTrainingGallery = (index = 0) => {
    const items = filteredRecords
      .map((item) => getMediaUrl(item.thumbnail || item.banner))
      .filter(Boolean)
      .map((url) => ({ url }));
    const galleryItems = items.length ? items : safetyGallery.map((url) => ({ url }));
    setImageModal({ open: true, items: galleryItems, index: Math.max(0, index), compare: null });
  };

  const openTrainingMedia = (record = activeTraining) => {
    const videoUrl = getMediaUrl(record?.video?.url || record?.video);
    const imageUrl = getMediaUrl(record?.thumbnail?.url || record?.banner || record?.thumbnail);
    const assets = [videoUrl || imageUrl].filter(Boolean).map((url) => ({ url }));
    if (!assets.length) return;
    setImageModal({ open: true, items: assets, index: 0, compare: null });
  };

  return (
    <div className="safety-bg-overlay safety-bg-training space-y-5">
      <PageHeader
        title="Training Streaming Portal"
        subtitle="Legacy training layout and workflows restored with enterprise visual experience"
      />

      <GlassCard className="p-5">
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-xl px-3 py-1.5 text-xs ${
                activeCategory === category
                  ? "bg-teal-500/30 text-teal-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {category}
            </button>
          ))}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search training..."
            className="ml-auto min-w-[200px] rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white"
          />
        </div>
      </GlassCard>

      {activeTraining ? (
        <GlassCard className="overflow-hidden p-0">
          <button
            type="button"
            className="group training-preview-panel relative h-[360px] w-full overflow-hidden text-left md:h-[430px]"
            onClick={() => {
              openTrainingMedia(activeTraining);
              updateProgress(activeTraining, 100);
            }}
            onMouseEnter={() => setPlayVideo(true)}
          >
            <div className="training-preview-scroll absolute inset-0 h-full w-full overflow-hidden">
              {effectivePreviewVideo ? (
                <video
                  ref={previewVideoRef}
                  src={effectivePreviewVideo}
                  poster={activeBannerUrl}
                  className="training-preview-media absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={activeBannerUrl}
                  alt={activeTraining.title}
                  className="training-preview-media absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-5 left-5 right-5 max-w-3xl md:bottom-8 md:left-8 md:right-8">
              <p className="mb-2 inline-flex rounded-full bg-black/60 px-3 py-1 text-[11px] text-teal-100">
                {activeTraining.category || "General"}
              </p>
              <h3 className="font-display text-2xl font-semibold text-white md:text-4xl">
                {activeTraining.title}
              </h3>
              <p className="mt-2 text-xs text-slate-200 md:text-base">{activeTraining.description}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs text-white">
                <PlayCircle size={16} />
                Open Training
              </span>
            </div>
          </button>
        </GlassCard>
      ) : null}

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <BookOpen className="text-teal-300" size={18} />
            Training Concepts
          </h3>
          <button
            type="button"
            onClick={() => openTrainingGallery(0)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200"
          >
            Open Image Gallery
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading training modules...</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredRecords.map((record) => {
              const progress = userProgressMap.get(record._id) || 0;
              const thumb =
                getMediaUrl(record.thumbnail?.url || record.thumbnail || record.banner) ||
                safetyGallery[0] ||
                IMAGE_PLACEHOLDER_URL;
              return (
                <motion.article
                  key={record._id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="relative min-w-[320px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left shadow-xl"
                >
                  {canManageConcepts ? (
                    <button
                      type="button"
                      onClick={(event) => deleteConcept(record, event)}
                      disabled={deletingId === record._id}
                      className="absolute right-3 top-3 z-20 rounded-full border border-rose-400/40 bg-black/60 p-2 text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Delete ${record.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActiveTraining(record);
                      setPlayVideo(true);
                    }}
                    onClick={() => {
                      setActiveTraining(record);
                      openTrainingMedia(record);
                      updateProgress(record, Math.min(100, progress + 25));
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={thumb}
                        alt={record.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        style={{ objectFit: "cover", objectPosition: "center" }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <p className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white">
                        {record.category || "General"}
                      </p>
                      <span className="absolute bottom-3 right-3 rounded-full bg-teal-500/80 p-2 text-white shadow-lg">
                        <PlayCircle size={18} />
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-white">{record.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-300">{record.description}</p>
                      <div className="mt-3 rounded-full bg-white/10 p-1">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                        <span>{progress}% complete</span>
                        <span>{record.durationMinutes || 10} mins</span>
                      </div>
                    </div>
                  </button>
                </motion.article>
              );
            })}
            {filteredRecords.length === 0 ? (
              <p className="text-xs text-slate-300">No training modules found for the selected filters.</p>
            ) : null}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <HardHat className="text-amber-300" size={18} />
            Safety Awareness Gallery
          </h3>
          <p className="text-xs text-slate-300">Click any image to preview fullscreen</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {safetyGallery.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setImageModal({
                  open: true,
                  items: safetyGallery.map((item) => ({ url: item })),
                  index,
                  compare: null
                });
              }}
              className="min-w-[300px] overflow-hidden rounded-3xl border border-white/10 bg-white/5"
            >
              <img
                src={src}
                alt="Safety awareness"
                loading="lazy"
                className="h-44 w-full object-cover transition duration-500 hover:scale-105"
              />
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {canUpload ? (
          <GlassCard className="p-5">
            <h3 className="mb-2 text-lg font-semibold text-white">Upload New Training</h3>
            <form className="space-y-2" onSubmit={uploadTraining}>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Training Title"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
                required
              />
              <input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Category"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
                required
              />
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Training Description"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
                required
              />
              <input
                type="file"
                accept="video/*"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setVideo(selected);
                  if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
                  setVideoPreview(selected ? URL.createObjectURL(selected) : "");
                }}
                className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
              />
              {videoPreview ? (
                <video
                  src={videoPreview}
                  controls
                  className="h-40 w-full rounded-xl border border-white/10 object-cover"
                />
              ) : null}
              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload Training"}
              </button>
            </form>
          </GlassCard>
        ) : null}

        <GlassCard className="p-5">
          <h3 className="mb-2 text-lg font-semibold text-white">Certificates</h3>
          <div className="space-y-2">
            {certificates.length === 0 ? (
              <p className="text-xs text-slate-300">No certificates yet.</p>
            ) : (
              certificates.map((certificate) => (
                <div
                  key={`${certificate.trainingId}-${certificate.completedAt}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5"
                >
                  <p className="text-xs font-medium text-white">{certificate.title}</p>
                  <p className="text-[11px] text-slate-300">
                    Completed: {formatDateTime(certificate.completedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      <MediaStudioModal
        open={imageModal.open}
        onClose={() => setImageModal((prev) => ({ ...prev, open: false }))}
        items={imageModal.items}
        activeIndex={imageModal.index}
        onIndexChange={(index) => setImageModal((prev) => ({ ...prev, index }))}
        compare={imageModal.compare}
      />
    </div>
  );
};

export default TrainingPage;
