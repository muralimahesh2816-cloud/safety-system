import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, Film, ImagePlus, Trash2, X } from "lucide-react";
import useDeviceLocation, { getLocationMessage, LOCATION_STATUS } from "../../hooks/useDeviceLocation";
import { createVideoPoster, stampImageFile } from "../../utils/GpsImageStamp";
import { locationService } from "../../api/services";
import MediaLocationCard from "./MediaLocationCard";

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;

const formatSize = (bytes = 0) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const attachMetadata = (file, metadata, posterFile = null) => {
  Object.defineProperty(file, "evidenceMetadata", { configurable: true, value: metadata });
  if (posterFile) Object.defineProperty(file, "evidencePosterFile", { configurable: true, value: posterFile });
  return file;
};

const locationStatusFor = (status, location) => location
  ? (location.lowAccuracy ? "low_accuracy" : "captured")
  : status;

const DirectMediaCapture = ({
  label = "Evidence",
  module,
  stage,
  reference = "",
  siteName = "",
  capturedBy = "",
  maxImages = 10,
  maxVideos = 10,
  onChange,
  resetKey = 0,
  compact = false
}) => {
  const photoRef = useRef(null);
  const videoRef = useRef(null);
  const galleryRef = useRef(null);
  const itemsRef = useRef([]);
  const onChangeRef = useRef(onChange);
  const [items, setItems] = useState([]);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [viewingItem, setViewingItem] = useState(null);
  const accuracyWarningMeters = Number(process.env.REACT_APP_MAX_ACCEPTABLE_GPS_ACCURACY_METERS || 100);
  const { status, captureLocation } = useDeviceLocation({ accuracyWarningMeters });

  const resolveAddress = async (rawLocation) => {
    if (!rawLocation) return null;
    try {
      const response = await locationService.reverseGeocode(rawLocation);
      return { ...rawLocation, ...(response?.data || {}) };
    } catch (_error) {
      return {
        ...rawLocation,
        formattedAddress: "Address unavailable",
        reverseGeocodeStatus: "failed"
      };
    }
  };

  const captureEvidenceLocation = async () => {
    const result = await captureLocation();
    if (!result.location) return result;
    return { ...result, location: await resolveAddress(result.location) };
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    itemsRef.current = items;
    onChangeRef.current?.(items.map((item) => item.file));
  }, [items]);

  useEffect(() => {
    itemsRef.current.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.posterPreviewUrl) URL.revokeObjectURL(item.posterPreviewUrl);
    });
    itemsRef.current = [];
    setItems([]);
  }, [resetKey]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.posterPreviewUrl) URL.revokeObjectURL(item.posterPreviewUrl);
    });
  }, []);

  const counts = useMemo(() => items.reduce((acc, item) => {
    acc[item.mediaType] += 1;
    return acc;
  }, { image: 0, video: 0 }), [items]);

  const buildItem = async (originalFile, captureSource, forcedLocation) => {
    const mediaType = originalFile.type.startsWith("video/") ? "video" : "image";
    const locationResult = forcedLocation || (includeLocation
      ? await captureEvidenceLocation()
      : { status: "not_requested", location: null });
    const capturedAt = locationResult.location?.capturedAt || new Date().toISOString();
    const details = { location: locationResult.location, capturedAt, captureSource, reference, siteName, capturedBy };
    let processedFile = originalFile;
    let posterFile = null;
    let watermarkStatus = "not_required";
    if (mediaType === "image") {
      try {
        processedFile = await stampImageFile(originalFile, details);
        watermarkStatus = "completed";
      } catch (_error) {
        watermarkStatus = "failed";
      }
    } else {
      posterFile = await createVideoPoster(originalFile, details);
      watermarkStatus = posterFile ? "completed" : "failed";
    }

    const metadata = {
      module,
      stage,
      mediaType,
      captureSource,
      originalFileName: originalFile.name,
      mimeType: processedFile.type,
      sizeBytes: processedFile.size,
      capturedAt,
      location: locationResult.location
        ? { ...locationResult.location, permissionStatus: "granted" }
        : { permissionStatus: locationResult.status, capturedAt, locationSource: "browser_geolocation", isVerified: false },
      watermark: { applied: mediaType === "image" && watermarkStatus === "completed", version: "gps-stamp-v1", processingStatus: watermarkStatus },
      videoOverlay: mediaType === "video" ? "player_metadata" : undefined
    };
    attachMetadata(processedFile, metadata, posterFile);
    return {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      file: processedFile,
      originalFile,
      previewUrl: URL.createObjectURL(processedFile),
      metadata,
      mediaType,
      captureSource,
      posterFile,
      posterPreviewUrl: posterFile ? URL.createObjectURL(posterFile) : ""
    };
  };

  const selectFiles = async (fileList, captureSource) => {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;
    setMessage("");
    const imageSlots = Math.max(0, maxImages - counts.image);
    const videoSlots = Math.max(0, maxVideos - counts.video);
    const accepted = [];
    let nextImages = 0;
    let nextVideos = 0;
    for (const file of selected) {
      if (file.type.startsWith("image/")) {
        if (file.size > IMAGE_LIMIT) { setMessage("The selected image exceeds the allowed size."); continue; }
        if (nextImages >= imageSlots) { setMessage(`Maximum ${maxImages} images are allowed.`); continue; }
        nextImages += 1;
        accepted.push(file);
      } else if (file.type.startsWith("video/")) {
        if (file.size > VIDEO_LIMIT) { setMessage("The selected video exceeds the allowed size."); continue; }
        if (nextVideos >= videoSlots) { setMessage(`Maximum ${maxVideos} videos are allowed.`); continue; }
        nextVideos += 1;
        accepted.push(file);
      } else {
        setMessage("The selected file format is not supported.");
      }
    }
    if (!accepted.length) return;
    setProcessing(true);
    const sharedLocation = includeLocation ? await captureEvidenceLocation() : { status: "not_requested", location: null };
    const prepared = [];
    for (const file of accepted) prepared.push(await buildItem(file, captureSource, sharedLocation));
    setItems((previous) => [...previous, ...prepared]);
    setProcessing(false);
  };

  const removeItem = (id) => setItems((previous) => previous.filter((item) => {
    if (item.id === id) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.posterPreviewUrl) URL.revokeObjectURL(item.posterPreviewUrl);
    }
    return item.id !== id;
  }));

  const retryLocation = async (item) => {
    setProcessing(true);
    const nextLocation = await captureEvidenceLocation();
    if (nextLocation.location) {
      const replacement = await buildItem(item.originalFile, item.captureSource, nextLocation);
      URL.revokeObjectURL(replacement.previewUrl);
      replacement.id = item.id;
      replacement.previewUrl = URL.createObjectURL(replacement.file);
      setItems((previous) => previous.map((entry) => {
        if (entry.id !== item.id) return entry;
        URL.revokeObjectURL(entry.previewUrl);
        if (entry.posterPreviewUrl) URL.revokeObjectURL(entry.posterPreviewUrl);
        return replacement;
      }));
    }
    setProcessing(false);
  };

  const refreshAddress = async (item) => {
    if (item.metadata.location?.latitude == null) return;
    setProcessing(true);
    const resolved = await resolveAddress(item.metadata.location);
    const replacement = await buildItem(item.originalFile, item.captureSource, {
      status: LOCATION_STATUS.CAPTURED,
      location: resolved
    });
    replacement.id = item.id;
    setItems((previous) => previous.map((entry) => {
      if (entry.id !== item.id) return entry;
      URL.revokeObjectURL(entry.previewUrl);
      if (entry.posterPreviewUrl) URL.revokeObjectURL(entry.posterPreviewUrl);
      return replacement;
    }));
    setProcessing(false);
  };

  const removeLocation = async (item) => {
    setProcessing(true);
    const replacement = await buildItem(item.originalFile, item.captureSource, {
      status: "not_requested",
      location: null
    });
    replacement.id = item.id;
    setItems((previous) => previous.map((entry) => {
      if (entry.id !== item.id) return entry;
      URL.revokeObjectURL(entry.previewUrl);
      if (entry.posterPreviewUrl) URL.revokeObjectURL(entry.posterPreviewUrl);
      return replacement;
    }));
    setProcessing(false);
  };

  const openPicker = (ref) => {
    if (typeof window !== "undefined" && !window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setMessage("A secure HTTPS connection is required for direct camera and GPS evidence.");
    }
    ref.current?.click();
  };

  return (
    <section className="rounded-2xl border border-white/12 bg-slate-950/45 p-3" aria-label={label}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-[11px] text-slate-400">Camera access is used only to capture safety evidence for this report.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={includeLocation} onChange={(event) => setIncludeLocation(event.target.checked)} />
          Include capture location
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Location is requested only after you choose or capture media. It is not tracked in the background.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => openPicker(photoRef)} disabled={processing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 disabled:opacity-50"><Camera size={15} /> Take Photo</button>
        <button type="button" onClick={() => openPicker(videoRef)} disabled={processing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"><Film size={15} /> Record Video</button>
        <button type="button" onClick={() => openPicker(galleryRef)} disabled={processing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><ImagePlus size={15} /> Choose from Gallery</button>
      </div>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { selectFiles(event.target.files, "camera"); event.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(event) => { selectFiles(event.target.files, "camera"); event.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm" multiple hidden onChange={(event) => { selectFiles(event.target.files, "gallery"); event.target.value = ""; }} />
      {processing ? <p className="mt-3 text-xs text-cyan-200" aria-live="polite">Requesting location and preparing evidence preview…</p> : null}
      {message ? <p className="mt-3 text-xs text-amber-200" role="alert">{message}</p> : null}
      {status !== LOCATION_STATUS.IDLE && status !== LOCATION_STATUS.CAPTURED && !processing ? <p className="mt-2 text-[11px] text-amber-200">{getLocationMessage(status)}</p> : null}
      {items.length ? (
        <div className={`evidence-preview-grid mt-3 ${compact ? "evidence-preview-grid--compact" : ""}`}>
          {items.map((item) => {
            const location = item.metadata.location?.latitude != null ? item.metadata.location : null;
            const gpsStatus = locationStatusFor(item.metadata.location?.permissionStatus, location);
            return (
              <article key={item.id} className="media-evidence-card min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <button type="button" className="media-evidence-card__preview" onClick={() => setViewingItem(item)} aria-label={`Preview ${item.metadata.originalFileName}`}>
                  {item.mediaType === "video" && item.posterPreviewUrl
                    ? <img src={item.posterPreviewUrl} alt={`Video poster for ${item.metadata.originalFileName}`} />
                    : item.mediaType === "video"
                      ? <span><Film size={30} /> Video preview</span>
                      : <img src={item.previewUrl} alt={`${label}: ${item.metadata.originalFileName}`} />}
                </button>
                <div className="min-w-0 space-y-2 p-3 text-[11px] text-slate-300">
                  <p className="break-words font-semibold leading-5 text-white" title={item.metadata.originalFileName}>{item.metadata.originalFileName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white/10 px-2 py-1 capitalize">{item.captureSource}</span>
                    <span className="rounded-full bg-cyan-500/10 px-2 py-1 capitalize text-cyan-100">{item.mediaType}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-100">Ready to upload</span>
                  </div>
                  <p>{formatSize(item.file.size)}</p>
                  <MediaLocationCard
                    compact
                    location={location}
                    status={gpsStatus}
                    readOnly={false}
                    canRetry
                    canRemove
                    onRetryGps={() => retryLocation(item)}
                    onRefreshAddress={location ? () => refreshAddress(item) : undefined}
                    onRemove={location ? () => removeLocation(item) : undefined}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => setViewingItem(item)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-slate-100"><Eye size={14} /> Preview</button>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.metadata.originalFileName}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-300/20 px-3 py-2 text-rose-200"><Trash2 size={14} /> Remove</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="mt-3 text-[11px] text-slate-500">No evidence selected. Desktop browsers may open the standard file picker when native capture is unavailable.</p>}
      {viewingItem ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${viewingItem.metadata.originalFileName}`} onClick={() => setViewingItem(null)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-3" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setViewingItem(null)} aria-label="Close preview" className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/80 text-white"><X size={20} /></button>
            {viewingItem.mediaType === "video"
              ? <video src={viewingItem.previewUrl} controls preload="metadata" poster={viewingItem.posterPreviewUrl || undefined} className="max-h-[84vh] w-full object-contain" />
              : <img src={viewingItem.previewUrl} alt={`${label}: ${viewingItem.metadata.originalFileName}`} className="max-h-[84vh] w-full object-contain" />}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DirectMediaCapture;
