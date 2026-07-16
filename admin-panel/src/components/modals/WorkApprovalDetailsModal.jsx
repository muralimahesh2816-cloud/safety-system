import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Download, Image as ImageIcon, MapPin, Maximize2, UsersRound, UserRound, Wrench, X } from "lucide-react";
import { formatDateTime } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";
import { exportWorkApprovalDetailsPdf } from "../../utils/detailPdfExport";
import { formatChainageRange, getChainageFrom, getChainageTo } from "../../utils/chainage";

const valueOrDash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source
    .map((item) => ({ url: getMediaUrl(item), title: item?.title || item?.name || "Work media" }))
    .filter((item) => Boolean(item.url));
};
const isVideoUrl = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url);

const statusTone = (status = "Pending") => ({
  Pending: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  Approved: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  Rejected: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  Completed: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
}[status] || "border-slate-400/40 bg-slate-500/15 text-slate-200");

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-white/[0.08] py-3 last:border-b-0 sm:grid-cols-[155px_minmax(0,1fr)]">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {Icon ? <Icon size={14} className="shrink-0 text-cyan-300" /> : null}
      {label}
    </div>
    <div className="min-w-0 break-words text-sm font-medium text-slate-100">{valueOrDash(value)}</div>
  </div>
);

const ImagePanel = ({ label, tone, item, onOpen }) => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} className={tone} />
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
      {item ? (
        <div className="flex gap-2">
          <button type="button" onClick={onOpen} className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-cyan-500/20" aria-label={`Open ${label}`}>
            <Maximize2 size={15} />
          </button>
          <a href={item.url} download target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 p-2 text-slate-100 transition hover:bg-emerald-500/20" aria-label={`Download ${label}`}>
            <Download size={15} />
          </a>
        </div>
      ) : null}
    </div>
    {item ? (
      <button type="button" onClick={onOpen} className="group flex h-56 w-full items-center justify-center overflow-hidden bg-slate-950/70 p-3 sm:h-64">
        {isVideoUrl(item.url) ? (
          <video src={item.url} muted playsInline className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.02]" />
        ) : (
          <img src={item.url} alt={label} loading="lazy" className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.02]" />
        )}
      </button>
    ) : (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500 sm:h-64">No Media Available</div>
    )}
  </div>
);

const WorkApprovalDetailsModal = ({ open, work, onClose, onOpenMedia }) => {
  const [exporting, setExporting] = useState(false);
  const before = useMemo(() => normalizeMedia(work?.beforeImages, work?.beforeImage), [work]);
  const after = useMemo(() => normalizeMedia(work?.afterImages, work?.afterImage), [work]);
  const beforeVideos = useMemo(() => normalizeMedia(work?.beforeVideos, work?.beforeVideo), [work]);
  const afterVideos = useMemo(() => normalizeMedia(work?.afterVideos, work?.afterVideo), [work]);
  const beforeMedia = useMemo(() => [...before, ...beforeVideos], [before, beforeVideos]);
  const afterMedia = useMemo(() => [...after, ...afterVideos], [after, afterVideos]);
  const allMedia = useMemo(() => [...beforeMedia, ...afterMedia], [afterMedia, beforeMedia]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const status = work?.status || "Pending";
  const openMedia = (index) => onOpenMedia?.(allMedia, index);
  const completionDate = status === "Completed"
    ? work?.completedAt || work?.completionDate || work?.updatedAt
    : work?.completionDate;
  const createdBy =
    work?.createdByName ||
    work?.reportedBy ||
    work?.createdBy?.name ||
    work?.submittedBy?.name ||
    work?.employeeName;

  const downloadPdf = async () => {
    if (exporting || !work) return;
    setExporting(true);
    try {
      await exportWorkApprovalDetailsPdf(work);
    } catch (_error) {
      window.alert("Unable to generate the Work Approval PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && work ? (
        <motion.div
          className="fixed inset-0 z-[90000] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Work Approval Details"
            className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-[0_35px_110px_rgba(0,0,0,.65)]"
            initial={{ y: 28, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

            <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7 sm:py-5">
              <div className="min-w-0">
                <span className={`mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone(status)}`}>{status}</span>
                <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Work Approval Details</h2>
                <p className="mt-1 truncate text-sm text-slate-400">{work.workType || work.title || "Work Approval"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-60"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">{exporting ? "Preparing PDF..." : "Download Full PDF"}</span>
                </button>
                <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.08] p-2.5 text-slate-200 transition hover:bg-rose-500/20 hover:text-white" aria-label="Close work details">
                  <X size={19} />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Wrench size={19} className="text-cyan-300" />
                    <h3 className="font-display text-base font-semibold text-white">Work Information</h3>
                  </div>
                  <InfoRow label="Approval No" value={work.approvalNumber} />
                  <InfoRow label="Work Type" value={work.workType || work.title} icon={Wrench} />
                  <InfoRow label="Location" value={work.location || work.plaza} icon={MapPin} />
                  <InfoRow label="Chainage From" value={getChainageFrom(work)} />
                  <InfoRow label="Chainage To" value={getChainageTo(work)} />
                  <InfoRow label="Chainage Range" value={formatChainageRange(work)} />
                  <InfoRow label="Workers Count" value={work.workersCount} icon={UsersRound} />
                  <InfoRow label="Created By" value={createdBy} icon={UserRound} />
                  <InfoRow label="Created Role" value={work.createdByRole} />
                  <InfoRow label="Checked By" value={work.checkedBy} />
                  <InfoRow label="Recommended By" value={work.recommendedBy} />
                  <InfoRow label="Created Date" value={formatDateTime(work.reportDate || work.startDate || work.createdAt)} icon={CalendarDays} />
                  <InfoRow label="Status" value={status} />
                  <InfoRow label="Approved By" value={work.approvedByName || work.approvedBy} />
                  <InfoRow label="Approved Role" value={work.approvedByRole} />
                  <InfoRow label="Approval Date" value={work.approvedAt || work.approvalDate ? formatDateTime(work.approvedAt || work.approvalDate) : "-"} />
                  <InfoRow label="Completion Date" value={completionDate ? formatDateTime(completionDate) : "-"} />

                  <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.06] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Work Description</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                      {work.description || work.workDescription || work.details || "No description entered."}
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Approval Timeline</p>
                    <div className="mt-3 space-y-3">
                      {(work.timeline || work.approvalHistory || []).slice(-6).reverse().map((item, index) => (
                        <div key={`${item.at || item.createdAt || index}-${index}`} className="flex gap-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.label || item.status || item.description || "Work updated"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.at || item.createdAt || item.date)}</p>
                          </div>
                        </div>
                      ))}
                      {!(work.timeline || work.approvalHistory || []).length ? (
                        <p className="text-sm text-slate-500">Submitted {formatDateTime(work.createdAt)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <ImagePanel label="Before Work Media" tone="text-teal-300" item={beforeMedia[0]} onOpen={() => openMedia(0)} />
                  <ImagePanel label="After Work Media" tone="text-emerald-300" item={afterMedia[0]} onOpen={() => openMedia(beforeMedia.length)} />
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default WorkApprovalDetailsModal;
