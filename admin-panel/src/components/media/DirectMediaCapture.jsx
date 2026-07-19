import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Film, ImagePlus, LocateFixed, RefreshCw, Trash2 } from "lucide-react";
import useDeviceLocation, { getLocationMessage, LOCATION_STATUS } from "../../hooks/useDeviceLocation";
import { createVideoPoster, stampImageFile } from "../../utils/GpsImageStamp";

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
  const [items, setItems] = useState([]);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const accuracyWarningMeters = Number(process.env.REACT_APP_MAX_ACCEPTABLE_GPS_ACCURACY_METERS || 100);
  const { status, captureLocation } = useDeviceLocation({ accuracyWarningMeters });

  useEffect(() => {
    itemsRef.current = items;
    onChange?.(items.map((item) => item.file));
  }, [items, onChange]);

  useEffect(() => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    itemsRef.current = [];
    setItems([]);
  }, [resetKey]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const counts = useMemo(() => items.reduce((acc, item) => {
    acc[item.mediaType] += 1;
    return acc;
  }, { image: 0, video: 0 }), [items]);

  const buildItem = async (originalFile, captureSource, forcedLocation) => {
    const mediaType = originalFile.type.startsWith("video/") ? "video" : "image";
    const locationResult = forcedLocation || (includeLocation
      ? await captureLocation()
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
      posterFile
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
    const sharedLocation = includeLocation ? await captureLocation() : { status: "not_requested", location: null };
    const prepared = [];
    for (const file of accepted) prepared.push(await buildItem(file, captureSource, sharedLocation));
    setItems((previous) => [...previous, ...prepared]);
    setProcessing(false);
  };

  const removeItem = (id) => setItems((previous) => previous.filter((item) => {
    if (item.id === id) URL.revokeObjectURL(item.previewUrl);
    return item.id !== id;
  }));

  const retryLocation = async (item) => {
    setProcessing(true);
    const nextLocation = await captureLocation();
    if (nextLocation.location) {
      const replacement = await buildItem(item.originalFile, item.captureSource, nextLocation);
      URL.revokeObjectURL(replacement.previewUrl);
      replacement.id = item.id;
      replacement.previewUrl = URL.createObjectURL(replacement.file);
      setItems((previous) => previous.map((entry) => {
        if (entry.id !== item.id) return entry;
        URL.revokeObjectURL(entry.previewUrl);
        return replacement;
      }));
    }
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
        <button type="button" onClick={() => openPicker(photoRef)} disabled={processing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 disabled:opacity-50"><Camera size={15} /> Take Photo</button>
        <button type="button" onClick={() => openPicker(videoRef)} disabled={processing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"><Film size={15} /> Record Video</button>
        <button type="button" onClick={() => openPicker(galleryRef)} disabled={processing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><ImagePlus size={15} /> Choose Gallery</button>
      </div>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { selectFiles(event.target.files, "camera"); event.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(event) => { selectFiles(event.target.files, "camera"); event.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm" multiple hidden onChange={(event) => { selectFiles(event.target.files, "gallery"); event.target.value = ""; }} />
      {processing ? <p className="mt-3 text-xs text-cyan-200">Preparing preview and evidence stamp…</p> : null}
      {message ? <p className="mt-3 text-xs text-amber-200" role="alert">{message}</p> : null}
      {status !== LOCATION_STATUS.IDLE && status !== LOCATION_STATUS.CAPTURED && !processing ? <p className="mt-2 text-[11px] text-amber-200">{getLocationMessage(status)}</p> : null}
      {items.length ? (
        <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {items.map((item) => {
            const location = item.metadata.location?.latitude != null ? item.metadata.location : null;
            const gpsStatus = locationStatusFor(item.metadata.location?.permissionStatus, location);
            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {item.mediaType === "video" ? <video src={item.previewUrl} controls preload="metadata" poster={item.posterFile ? URL.createObjectURL(item.posterFile) : undefined} className="h-32 w-full bg-black object-contain" /> : <img src={item.previewUrl} alt={`${label} preview`} className="h-32 w-full object-contain" />}
                <div className="space-y-1.5 p-3 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-white">{item.metadata.originalFileName}</span><span className="rounded-full bg-white/10 px-2 py-0.5 capitalize">{item.captureSource}</span></div>
                  <p>{item.mediaType} • {formatSize(item.file.size)} • Ready to upload</p>
                  <p className={location?.lowAccuracy ? "text-amber-200" : location ? "text-emerald-200" : "text-slate-400"}><LocateFixed size={12} className="mr-1 inline" />{location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} • ±${Math.round(location.accuracyMeters)} m` : getLocationMessage(gpsStatus)}</p>
                  {location?.lowAccuracy ? <p className="text-amber-200">Location accuracy is approximately {Math.round(location.accuracyMeters)} metres. Move to an open area and retry.</p> : null}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => retryLocation(item)} disabled={processing} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-slate-200"><RefreshCw size={12} /> Retry GPS</button>
                    <button type="button" onClick={() => removeItem(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 px-2 py-1 text-rose-200"><Trash2 size={12} /> Remove</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="mt-3 text-[11px] text-slate-500">No evidence selected. Desktop browsers may open the standard file picker when native capture is unavailable.</p>}
    </section>
  );
};

export default DirectMediaCapture;
