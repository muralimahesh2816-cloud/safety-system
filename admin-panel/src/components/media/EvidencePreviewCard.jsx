import { Download, Film, Image as ImageIcon, Maximize2 } from "lucide-react";
import EvidenceLocationDetails from "./EvidenceLocationDetails";

const isVideoUrl = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const formatFileSize = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size not recorded";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const EvidencePreviewCard = ({ label, tone = "text-cyan-300", evidenceStage, item, onOpen }) => {
  const video = Boolean(item && (item.mediaType === "video" || isVideoUrl(item.url)));
  const fileName = item?.originalFileName || item?.originalName || item?.name ||
    (video ? "Video evidence" : "Image evidence");
  const stage = evidenceStage || item?.stage || "Evidence";

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {video ? <Film size={16} className={tone} aria-hidden="true" /> : <ImageIcon size={16} className={tone} aria-hidden="true" />}
          <p className="truncate text-sm font-semibold text-white">{label}</p>
        </div>
        {item ? (
          <div className="flex gap-2">
            <button type="button" onClick={onOpen} className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label={`Open ${label}`}>
              <Maximize2 size={15} aria-hidden="true" />
            </button>
            <a href={item.url} download target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" aria-label={`Download ${label}`}>
              <Download size={15} aria-hidden="true" />
            </a>
          </div>
        ) : null}
      </div>
      {item ? (
        <div className="p-3">
          <button type="button" onClick={onOpen} className="group flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {video ? (
              item.thumbnailUrl
                ? <img src={item.thumbnailUrl} alt={`${label} video poster`} loading="lazy" className="h-full w-full object-cover" />
                : <span className="text-sm text-slate-300">Open video preview</span>
            ) : (
              <img src={item.url} alt={label} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
            )}
          </button>
          <dl className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-[11px] sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Evidence Stage</dt>
              <dd className="mt-0.5 capitalize text-slate-200">{stage}</dd>
            </div>
            <div>
              <dt className="text-slate-500">File Type</dt>
              <dd className="mt-0.5 capitalize text-slate-200">{item.mimeType || item.mediaType || (video ? "video" : "image")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">File Information</dt>
              <dd className="mt-0.5 break-words text-slate-200">{fileName} - {formatFileSize(item.sizeBytes || item.size)}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <EvidenceLocationDetails location={item.location} readOnly showOpenLocation compact />
          </div>
        </div>
      ) : (
        <div className="flex h-56 items-center justify-center text-sm text-slate-500 sm:h-64">No Media Available</div>
      )}
    </article>
  );
};

export default EvidencePreviewCard;

