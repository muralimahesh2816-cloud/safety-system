import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  MapPin,
  ShieldAlert,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { formatDateTime } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";
import { exportHazardDetailsPdf } from "../../utils/detailPdfExport";
import EvidencePreviewCard from "../media/EvidencePreviewCard";
import ModalPortal from "../common/ModalPortal";

const valueOrDash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source
    .map((item) => ({
      ...((item && typeof item === "object") ? item : {}),
      url: getMediaUrl(item?.url || item),
      title: item?.title || item?.name || "Hazard media"
    }))
    .filter((item) => Boolean(item.url));
};

const riskTone = (hazard = {}) => {
  const score = Number(hazard.riskScore || 0);
  const severity = String(hazard.severity || "").toLowerCase();
  if (severity === "critical" || score >= 12) return "border-rose-400/40 bg-rose-500/15 text-rose-200";
  if (severity === "high" || score >= 8) return "border-orange-400/40 bg-orange-500/15 text-orange-200";
  if (severity === "medium" || score >= 4) return "border-amber-400/40 bg-amber-500/15 text-amber-200";
  return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
};

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="grid grid-cols-[minmax(120px,145px)_minmax(0,1fr)] items-start gap-4 border-b border-white/[0.08] py-3 last:border-b-0">
    <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-slate-400">
      {Icon ? <Icon size={14} className="shrink-0 text-cyan-300" /> : null}
      {label}
    </div>
    <div className="min-w-0 break-words text-sm font-medium leading-5 text-slate-100">{valueOrDash(value)}</div>
  </div>
);

const HazardDetailsModal = ({ open, hazard, onClose, onOpenMedia }) => {
  const [exporting, setExporting] = useState(false);
  const evidence = useMemo(
    () => normalizeMedia(hazard?.evidenceImages, hazard?.beforeImage),
    [hazard]
  );
  const evidenceVideos = useMemo(
    () => normalizeMedia(hazard?.evidenceVideos, hazard?.beforeVideo),
    [hazard]
  );
  const closure = useMemo(
    () => normalizeMedia(hazard?.closureImages, hazard?.afterImage),
    [hazard]
  );
  const closureVideos = useMemo(
    () => normalizeMedia(hazard?.closureVideos, hazard?.afterVideo),
    [hazard]
  );
  const evidenceMedia = useMemo(() => [...evidence, ...evidenceVideos], [evidence, evidenceVideos]);
  const closureMedia = useMemo(() => [...closure, ...closureVideos], [closure, closureVideos]);
  const allMedia = useMemo(() => [...evidenceMedia, ...closureMedia], [closureMedia, evidenceMedia]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const openMedia = (index) => onOpenMedia?.(allMedia, index);
  const status = hazard?.status || "Open";
  const timeline = (hazard?.timeline || hazard?.approvalHistory || []).slice(-6).reverse();
  const correctiveActions = hazard?.correctiveActions || [];
  const actionTaken =
    hazard?.closureNotes ||
    correctiveActions.map((item) => item.action).filter(Boolean).join("\n") ||
    "No corrective action uploaded yet.";

  const downloadPdf = async () => {
    if (exporting || !hazard) return;
    setExporting(true);
    try {
      await exportHazardDetailsPdf(hazard);
    } catch (_error) {
      window.alert("Unable to generate the Hazard PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ModalPortal>
    <AnimatePresence>
      {open && hazard ? (
        <motion.div
          className="hse-overlay flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Hazard Details"
            className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-[0_35px_110px_rgba(0,0,0,.65)]"
            initial={{ y: 28, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

            <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7 sm:py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status === "Closed" ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-rose-400/40 bg-rose-500/15 text-rose-200"}`}>
                    {status}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskTone(hazard)}`}>
                    {hazard.severity || "Risk"} / Score {hazard.riskScore || 0}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Hazard Details</h2>
                <p className="mt-1 text-sm text-slate-400">Safety observation record</p>
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
                <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.08] p-2.5 text-slate-200 transition hover:bg-rose-500/20 hover:text-white" aria-label="Close hazard details">
                  <X size={19} />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert size={19} className="text-cyan-300" />
                    <h3 className="font-display text-base font-semibold text-white">Observation Information</h3>
                  </div>
                  <InfoRow label="Report Date" value={formatDateTime(hazard.date || hazard.createdAt)} icon={CalendarDays} />
                  <InfoRow label="Category" value={hazard.category} />
                  <InfoRow label="Risk Level" value={`${hazard.severity || "-"} / ${hazard.likelihood || "-"} (Score ${hazard.riskScore || 0})`} />
                  <InfoRow label="Location" value={hazard.location} icon={MapPin} />
                  <InfoRow label="Plaza Name" value={hazard.plaza} />
                  <InfoRow label="Reported By" value={hazard.reportedBy || hazard.createdBy?.name} icon={UserRound} />
                  <InfoRow label="Action Team" value={hazard.action || hazard.actionTeam} icon={UsersRound} />
                  <InfoRow label="Status" value={status} />

                  <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.06] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Description</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                      {hazard.description || hazard.details || hazard.observation || "No description entered."}
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-300" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                        Action Taken
                      </p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                      {actionTaken}
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Timeline</p>
                    <div className="mt-3 space-y-3">
                      {timeline.length ? timeline.map((item, index) => (
                        <div key={`${item.at || item.createdAt || index}-${index}`} className="flex gap-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.label || item.action || item.description || "Hazard updated"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.at || item.createdAt || item.date)}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-slate-500">Reported {formatDateTime(hazard.date || hazard.createdAt)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {evidenceMedia.length ? evidenceMedia.map((item, index) => (
                    <EvidencePreviewCard key={item.id || item.url || index} label={`Initial Evidence ${index + 1}`} evidenceStage="Initial Hazard Evidence" tone="text-amber-300" item={item} onOpen={() => openMedia(index)} />
                  )) : <EvidencePreviewCard label="Initial Evidence" evidenceStage="Initial Hazard Evidence" tone="text-amber-300" />}
                  {closureMedia.length ? closureMedia.map((item, index) => (
                    <EvidencePreviewCard key={item.id || item.url || index} label={`Corrective Action Evidence ${index + 1}`} evidenceStage="Corrective Action" tone="text-emerald-300" item={item} onOpen={() => openMedia(evidenceMedia.length + index)} />
                  )) : <EvidencePreviewCard label="Corrective Action Evidence" evidenceStage="Corrective Action" tone="text-emerald-300" />}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </ModalPortal>
  );
};

export default HazardDetailsModal;
