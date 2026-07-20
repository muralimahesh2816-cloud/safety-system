import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCw, X } from "lucide-react";
import { getMediaUrl } from "../../utils/media";
import { formatDateTime } from "../../utils/format";
import EvidenceLocationDetails from "../media/EvidenceLocationDetails";

const isVideo = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const normalizeItems = (media, items = []) => {
  const source = items.length ? items : Array.isArray(media) ? media : media ? [media] : [];
  return source
    .map((item) => {
      const url = getMediaUrl(item?.url || item);
      return {
        ...((item && typeof item === "object") ? item : {}),
        url
      };
    })
    .filter((item) => Boolean(item.url));
};

const MediaStudioModal = ({
  media,
  title = "Media preview",
  onClose,
  open,
  items = [],
  activeIndex = 0,
  onIndexChange
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const galleryItems = normalizeItems(media, items);
  const shouldOpen = open ?? Boolean(media);
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, galleryItems.length - 1));
  const activeItem = galleryItems[safeIndex];
  const url = activeItem?.url || "";
  const displayTitle = activeItem?.title || activeItem?.name || title;
  const location = activeItem?.location;
  const activeIsVideo = activeItem?.mediaType === "video" || isVideo(url);
  const hasMultipleItems = galleryItems.length > 1;

  useEffect(() => {
    if (!shouldOpen || !url) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowLeft" && hasMultipleItems) {
        onIndexChange?.(safeIndex === 0 ? galleryItems.length - 1 : safeIndex - 1);
      }
      if (event.key === "ArrowRight" && hasMultipleItems) {
        onIndexChange?.(safeIndex === galleryItems.length - 1 ? 0 : safeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryItems.length, hasMultipleItems, onClose, onIndexChange, safeIndex, shouldOpen, url]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [url]);

  const goToPrevious = () => {
    if (!hasMultipleItems) return;
    onIndexChange?.(safeIndex === 0 ? galleryItems.length - 1 : safeIndex - 1);
  };

  const goToNext = () => {
    if (!hasMultipleItems) return;
    onIndexChange?.(safeIndex === galleryItems.length - 1 ? 0 : safeIndex + 1);
  };

  const downloadMedia = async () => {
    if (!url) return;
    const fallbackName = `hse-media-${Date.now()}`;
    const sourceName = activeItem?.name || activeItem?.filename || url.split("/").pop()?.split("?")[0] || fallbackName;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = sourceName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (_error) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AnimatePresence>
      {shouldOpen && url ? (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={displayTitle}
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,.58)]"
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{displayTitle}</p>
                {hasMultipleItems ? (
                  <p className="text-xs text-slate-400">
                    {safeIndex + 1} of {galleryItems.length}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {!activeIsVideo ? (
                  <>
                    <button className="rounded-xl bg-white/10 p-2 text-white" onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))} type="button"><Minus size={16} /></button>
                    <button className="rounded-xl bg-white/10 p-2 text-white" onClick={() => setZoom((v) => Math.min(3, v + 0.25))} type="button"><Plus size={16} /></button>
                    <button className="rounded-xl bg-white/10 p-2 text-white" onClick={() => setRotation((value) => (value + 90) % 360)} type="button" aria-label="Rotate image"><RotateCw size={16} /></button>
                  </>
                ) : null}
                <button className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-emerald-500/20" onClick={downloadMedia} type="button" aria-label="Download media"><Download size={16} /></button>
                <button className="rounded-xl bg-rose-500/20 p-2 text-rose-100 transition hover:bg-rose-500/30" onClick={onClose} type="button" aria-label="Close media"><X size={16} /></button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              {hasMultipleItems ? (
                <button
                  className="absolute left-4 top-1/2 z-10 rounded-full bg-slate-950/70 p-3 text-white shadow-lg"
                  onClick={goToPrevious}
                  type="button"
                  aria-label="Previous media"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              {activeIsVideo ? (
                <video src={url} controls preload="metadata" poster={activeItem?.thumbnailUrl || undefined} className="max-h-[78vh] w-full object-contain" />
              ) : (
                <img src={url} alt={displayTitle} className="max-h-[78vh] max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
              )}
              {hasMultipleItems ? (
                <button
                  className="absolute right-4 top-1/2 z-10 rounded-full bg-slate-950/70 p-3 text-white shadow-lg"
                  onClick={goToNext}
                  type="button"
                  aria-label="Next media"
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
              {(activeItem?.capturedAt || activeItem?.captureSource || location) ? (
                <div className="absolute bottom-4 left-4 max-h-[48%] max-w-[min(28rem,calc(100%-2rem))] overflow-auto rounded-2xl border border-orange-300/30 bg-slate-950/90 p-3 text-[11px] text-slate-200 shadow-xl backdrop-blur-xl">
                  <p className="font-bold text-white">Safety Management System</p>
                  <p className="mt-1 capitalize">{activeItem.stage || "Evidence"} • {activeItem.captureSource || "file"}</p>
                  <p>{formatDateTime(activeItem.capturedAt || location?.capturedAt || activeItem.uploadedAt)}</p>
                  <div className="mt-2"><EvidenceLocationDetails location={location} readOnly showOpenLocation compact /></div>
                  {activeItem.watermark?.processingStatus ? <p className="mt-1 capitalize text-slate-400">Watermark: {activeItem.watermark.processingStatus.replace(/_/g, " ")}</p> : null}
                </div>
              ) : null}
            </div>
            {hasMultipleItems ? (
              <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-slate-950/80 px-4 py-3">
                {galleryItems.map((item, index) => (
                  <button
                    key={`${item.url}-${index}`}
                    type="button"
                    onClick={() => onIndexChange?.(index)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition ${
                      index === safeIndex ? "border-cyan-300 bg-cyan-500/20" : "border-white/10 bg-white/5 opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Open media ${index + 1}`}
                  >
                    {item.mediaType === "video" || isVideo(item.url) ? (
                      <video src={item.url} muted className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.url} alt={item.title || `Media ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default MediaStudioModal;
