import { ExternalLink, LocateFixed, RefreshCw, Trash2 } from "lucide-react";
import {
  buildGoogleMapsUrl,
  formatLocationAccuracy,
  formatLocationCapturedAt,
  formatLocationCoordinates,
  formatLocationSource,
  normalizeEvidenceLocation
} from "../../utils/location";

const statusPresentation = (location, fallbackStatus) => {
  if (location?.status === "captured") return ["Location Captured", "text-cyan-200 bg-cyan-500/15"];
  if (location?.status === "address_only") return ["Address Only", "text-amber-200 bg-amber-500/15"];
  const labels = {
    denied: "GPS Permission Denied",
    timeout: "GPS Timed Out",
    unavailable: "GPS Unavailable",
    unsupported: "GPS Unsupported",
    insecure: "HTTPS Required"
  };
  return [labels[fallbackStatus] || "Location Not Recorded", "text-slate-300 bg-white/10"];
};

const EvidenceLocationDetails = ({
  location,
  status,
  readOnly = true,
  canRetry = false,
  canRemove = false,
  showOpenLocation = true,
  compact = false,
  onRetry,
  onRetryGps,
  onRefreshAddress,
  onRemove
}) => {
  const normalized = normalizeEvidenceLocation(location);
  const [badge, badgeClass] = statusPresentation(normalized, status || location?.permissionStatus);
  const mapUrl = showOpenLocation ? buildGoogleMapsUrl(normalized) : "";
  const retryHandler = onRetry || onRetryGps;
  const canUseRetry = !readOnly && canRetry && Boolean(retryHandler);
  const canUseRefresh = !readOnly && Boolean(normalized?.latitude != null && onRefreshAddress);
  const canUseRemove = !readOnly && canRemove && Boolean(onRemove);

  return (
    <section className="min-w-0 rounded-xl border border-white/10 bg-slate-950/55 p-3" aria-label="Location Details" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
          <LocateFixed size={14} aria-hidden="true" /> Location Details
        </h4>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClass}`}>{badge}</span>
      </div>

      {normalized ? (
        <dl className={`mt-3 grid gap-2 text-[11px] ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="mt-0.5 break-words leading-5 text-slate-200">
              {normalized.formattedAddress || "Address unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Coordinates</dt>
            <dd className="mt-0.5 break-all font-mono text-slate-200">{formatLocationCoordinates(normalized)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Accuracy</dt>
            <dd className="mt-0.5 text-slate-200">{formatLocationAccuracy(normalized)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Captured</dt>
            <dd className="mt-0.5 text-slate-200">{formatLocationCapturedAt(normalized)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Capture Source</dt>
            <dd className="mt-0.5 text-slate-200">{formatLocationSource(normalized)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Location Status</dt>
            <dd className="mt-0.5 text-slate-200">{normalized.status === "address_only" ? "Address recorded; coordinates not recorded" : "Captured"}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">Location not recorded.</p>
      )}

      {(canUseRetry || canUseRefresh || mapUrl || canUseRemove) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canUseRetry ? <button type="button" onClick={retryHandler} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-[11px] text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><RefreshCw size={12} aria-hidden="true" /> Retry Location</button> : null}
          {canUseRefresh ? <button type="button" onClick={onRefreshAddress} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-cyan-300/20 px-3 py-2 text-[11px] text-cyan-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><RefreshCw size={12} aria-hidden="true" /> Refresh Address</button> : null}
          {mapUrl ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label="Open captured location in Google Maps" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-emerald-300/20 px-3 py-2 text-[11px] text-emerald-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><ExternalLink size={12} aria-hidden="true" /> Open Location</a> : null}
          {canUseRemove ? <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-300/20 px-3 py-2 text-[11px] text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-300"><Trash2 size={12} aria-hidden="true" /> Remove Location</button> : null}
        </div>
      ) : null}
    </section>
  );
};

export default EvidenceLocationDetails;

