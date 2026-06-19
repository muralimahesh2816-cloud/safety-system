import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Download,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  ShieldAlert,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { formatDateTime } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";

const valueOrDash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source
    .map((item) => ({ url: getMediaUrl(item), title: item?.title || item?.name || "Hazard image" }))
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
        <img src={item.url} alt={label} loading="lazy" className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.02]" />
      </button>
    ) : (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500 sm:h-64">No Image Available</div>
    )}
  </div>
);

const HazardDetailsModal = ({ open, hazard, onClose, onOpenMedia }) => {
  const evidence = useMemo(
    () => normalizeMedia(hazard?.evidenceImages, hazard?.beforeImage),
    [hazard]
  );
  const closure = useMemo(
    () => normalizeMedia(hazard?.closureImages, hazard?.afterImage),
    [hazard]
  );
  const allMedia = useMemo(() => [...evidence, ...closure], [closure, evidence]);

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

  return (
    <AnimatePresence>
      {open && hazard ? (
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
                <p className="mt-1 truncate text-sm text-slate-400">{hazard.title || `${hazard.category || "Hazard"} - ${hazard.plaza || "Site"}`}</p>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.08] p-2.5 text-slate-200 transition hover:bg-rose-500/20 hover:text-white" aria-label="Close hazard details">
                <X size={19} />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert size={19} className="text-cyan-300" />
                    <h3 className="font-display text-base font-semibold text-white">Observation Information</h3>
                  </div>
                  <InfoRow label="Report Date" value={formatDateTime(hazard.date || hazard.createdAt)} icon={CalendarDays} />
                  <InfoRow label="Hazard Type" value={hazard.type || hazard.title || hazard.category} icon={ShieldAlert} />
                  <InfoRow label="Category" value={hazard.category} />
                  <InfoRow label="Risk Level" value={`${hazard.severity || "-"} / ${hazard.likelihood || "-"} (Score ${hazard.riskScore || 0})`} />
                  <InfoRow label="Location" value={hazard.location} icon={MapPin} />
                  <InfoRow label="Plaza Name" value={hazard.plaza} />
                  <InfoRow label="Reported By" value={hazard.reportedBy || hazard.createdBy?.name} icon={UserRound} />
                  <InfoRow label="Action Team" value={hazard.action || hazard.actionTeam} icon={UsersRound} />
                  <InfoRow label="Assigned To" value={hazard.assignedTo?.name || hazard.assignedTo} />
                  <InfoRow label="Status" value={status} />

                  <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.06] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Description</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                      {hazard.description || hazard.details || hazard.observation || "No description entered."}
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
                  <ImagePanel label="Before / Evidence Image" tone="text-amber-300" item={evidence[0]} onOpen={() => openMedia(0)} />
                  <ImagePanel label="After / Closure Image" tone="text-emerald-300" item={closure[0]} onOpen={() => openMedia(evidence.length)} />
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default HazardDetailsModal;
