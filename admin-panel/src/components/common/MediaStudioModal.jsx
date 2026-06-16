import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";
import { getMediaUrl } from "../../utils/media";

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
  const galleryItems = normalizeItems(media, items);
  const shouldOpen = open ?? Boolean(media);
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, galleryItems.length - 1));
  const activeItem = galleryItems[safeIndex];
  const url = activeItem?.url || "";
  const displayTitle = activeItem?.title || activeItem?.name || title;
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
  }, [url]);

  const goToPrevious = () => {
    if (!hasMultipleItems) return;
    onIndexChange?.(safeIndex === 0 ? galleryItems.length - 1 : safeIndex - 1);
  };

  const goToNext = () => {
    if (!hasMultipleItems) return;
    onIndexChange?.(safeIndex === galleryItems.length - 1 ? 0 : safeIndex + 1);
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
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 shadow-[0_30px_90px_rgba(0,0,0,.58)]"
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
                {!isVideo(url) ? (
                  <>
                    <button className="rounded-xl bg-white/10 p-2 text-white" onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))} type="button"><Minus size={16} /></button>
                    <button className="rounded-xl bg-white/10 p-2 text-white" onClick={() => setZoom((v) => Math.min(3, v + 0.25))} type="button"><Plus size={16} /></button>
                  </>
                ) : null}
                <a className="rounded-xl bg-white/10 p-2 text-white" href={url} download target="_blank" rel="noreferrer"><Download size={16} /></a>
                <button className="rounded-xl bg-rose-500/20 p-2 text-rose-100" onClick={onClose} type="button"><X size={16} /></button>
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
              {isVideo(url) ? (
                <video src={url} controls autoPlay className="max-h-[78vh] w-full object-contain" />
              ) : (
                <img src={url} alt={displayTitle} className="max-h-[78vh] max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} />
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
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default MediaStudioModal;
