import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Minus, Plus, X } from "lucide-react";
import { getMediaUrl } from "../../utils/media";

const isVideo = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const MediaStudioModal = ({ media, title = "Media preview", onClose }) => {
  const [zoom, setZoom] = useState(1);
  const url = getMediaUrl(media);

  useEffect(() => {
    if (!url) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, url]);

  return (
    <AnimatePresence>
      {url ? (
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
              <p className="truncate text-sm font-semibold text-white">{title}</p>
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
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              {isVideo(url) ? (
                <video src={url} controls autoPlay className="max-h-[78vh] w-full object-contain" />
              ) : (
                <img src={url} alt={title} className="max-h-[78vh] max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default MediaStudioModal;
