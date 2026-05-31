import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { downloadUrl } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";

const isVideoAsset = (url = "") =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(url) ||
  (url.startsWith("blob:") && url.includes("video")) ||
  url.includes("video/upload");

const MediaStudioModal = ({
  open,
  onClose,
  items = [],
  activeIndex = 0,
  onIndexChange = () => {},
  compare = null
}) => {
  const [zoom, setZoom] = useState(1);
  const [slider, setSlider] = useState(50);
  const [singleLoading, setSingleLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(true);

  const normalizedItems = useMemo(
    () =>
      (items || [])
        .map((item) => {
          if (typeof item === "string") return { url: getMediaUrl(item) };
          if (item?.url) return { ...item, url: getMediaUrl(item.url) };
          return { ...item, url: getMediaUrl(item) };
        })
        .filter((item) => Boolean(item.url)),
    [items]
  );
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, normalizedItems.length - 1));
  const current = normalizedItems[safeIndex];
  const currentUrl = getMediaUrl(current?.url || current);
  const currentIsVideo = isVideoAsset(currentUrl);
  const normalizedCompare = useMemo(
    () => ({
      before: getMediaUrl(compare?.before || compare?.beforeImage || compare?.left),
      after: getMediaUrl(compare?.after || compare?.afterImage || compare?.right)
    }),
    [compare]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && safeIndex > 0) onIndexChange(safeIndex - 1);
      if (event.key === "ArrowRight" && safeIndex < normalizedItems.length - 1) {
        onIndexChange(safeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onIndexChange, safeIndex, normalizedItems.length]);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setSingleLoading(true);
    setCompareLoading(true);
  }, [open, safeIndex, currentUrl, normalizedCompare.before, normalizedCompare.after]);

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < normalizedItems.length - 1;

  const comparisonReady = useMemo(
    () =>
      Boolean(
        normalizedCompare.before &&
          normalizedCompare.after &&
          !isVideoAsset(normalizedCompare.before) &&
          !isVideoAsset(normalizedCompare.after)
      ),
    [normalizedCompare.before, normalizedCompare.after]
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-xl"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.99, opacity: 0.96 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.99, opacity: 0 }}
            className="flex h-full flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3 md:px-6">
              <div className="text-xs text-slate-300">
                Media Studio {normalizedItems.length > 0 ? `${safeIndex + 1}/${normalizedItems.length}` : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(1))))}
                  className="rounded-xl border border-white/15 bg-white/10 p-2 text-white"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, Number((z + 0.2).toFixed(1))))}
                  className="rounded-xl border border-white/15 bg-white/10 p-2 text-white"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
                {currentUrl ? (
                  <button
                    type="button"
                    onClick={() => downloadUrl(currentUrl, "hse-media")}
                    className="rounded-xl border border-white/15 bg-white/10 p-2 text-white"
                    aria-label="Download media"
                  >
                    <Download size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 bg-white/10 p-2 text-white"
                  aria-label="Close media preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden p-3 md:p-6">
              {comparisonReady ? (
                <div className="relative mx-auto flex h-full max-h-[88vh] w-full max-w-[92vw] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/45">
                  {compareLoading ? (
                    <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-white/10 via-white/5 to-white/10" />
                  ) : null}
                  <img
                    src={normalizedCompare.before}
                    alt="Before"
                    loading="lazy"
                    className="h-full w-full object-contain"
                    style={{ transform: `scale(${zoom})` }}
                    onClick={(event) => event.stopPropagation()}
                    onLoad={() => setCompareLoading(false)}
                    onError={() => setCompareLoading(false)}
                  />
                  <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${slider}%` }}>
                    <img
                      src={normalizedCompare.after}
                      alt="After"
                      loading="lazy"
                      className="h-full w-full object-contain"
                      style={{ transform: `scale(${zoom})` }}
                      onClick={(event) => event.stopPropagation()}
                      onLoad={() => setCompareLoading(false)}
                      onError={() => setCompareLoading(false)}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={slider}
                    onChange={(event) => setSlider(Number(event.target.value))}
                    className="absolute bottom-4 left-1/2 w-60 -translate-x-1/2 accent-teal-400"
                    aria-label="Before after slider"
                  />
                </div>
              ) : currentUrl ? (
                <div className="relative mx-auto flex h-full max-h-[88vh] w-full max-w-[92vw] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/45">
                  {singleLoading ? (
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 via-white/5 to-white/10" />
                  ) : null}
                  {currentIsVideo ? (
                    <video
                      src={currentUrl}
                      controls
                      autoPlay
                      className="h-full w-full object-contain"
                      style={{ transform: `scale(${zoom})` }}
                      onClick={(event) => event.stopPropagation()}
                      onLoadedData={() => setSingleLoading(false)}
                      onError={() => setSingleLoading(false)}
                    />
                  ) : (
                    <img
                      src={currentUrl}
                      alt="Preview"
                      loading="lazy"
                      className="h-full w-full object-contain transition-transform duration-300"
                      style={{ transform: `scale(${zoom})` }}
                      onClick={(event) => event.stopPropagation()}
                      onLoad={() => setSingleLoading(false)}
                      onError={() => setSingleLoading(false)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">No media available</div>
              )}

              {canPrev ? (
                <button
                  type="button"
                  onClick={() => onIndexChange(safeIndex - 1)}
                  className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-900/80 p-3 text-white"
                  aria-label="Previous media"
                >
                  <ChevronLeft />
                </button>
              ) : null}
              {canNext ? (
                <button
                  type="button"
                  onClick={() => onIndexChange(safeIndex + 1)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-900/80 p-3 text-white"
                  aria-label="Next media"
                >
                  <ChevronRight />
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default MediaStudioModal;
