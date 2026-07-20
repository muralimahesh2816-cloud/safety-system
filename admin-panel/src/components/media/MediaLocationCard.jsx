import { ExternalLink, LocateFixed, RefreshCw, Trash2 } from "lucide-react";
import { formatDateTime } from "../../utils/format";

const badgeFor = (location, fallbackStatus) => {
  if (location?.reverseGeocodeStatus === "completed") return ["Address Resolved", "text-emerald-200 bg-emerald-500/15"];
  if (location?.lowAccuracy) return ["Low Accuracy", "text-amber-200 bg-amber-500/15"];
  if (location?.reverseGeocodeStatus === "failed" || location?.reverseGeocodeStatus === "unavailable") {
    return ["Address Unavailable", "text-amber-200 bg-amber-500/15"];
  }
  if (location?.latitude != null) return ["Location Captured", "text-cyan-200 bg-cyan-500/15"];
  if (location?.recorded) return ["Location Captured", "text-cyan-200 bg-cyan-500/15"];
  const labels = {
    denied: "GPS Permission Denied",
    timeout: "GPS Timed Out",
    unavailable: "GPS Unavailable",
    unsupported: "GPS Unsupported",
    insecure: "HTTPS Required"
  };
  return [labels[fallbackStatus] || "Location Not Included", "text-slate-300 bg-white/10"];
};

const MediaLocationCard = ({
  location,
  status,
  onRetryGps,
  onRefreshAddress,
  onRemove,
  canRemove = false,
  compact = false
}) => {
  const hasCoordinates = Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
  const [badge, badgeClass] = badgeFor(hasCoordinates ? location : null, status || location?.permissionStatus);
  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`
    : "";

  return (
    <section className="min-w-0 rounded-xl border border-white/10 bg-slate-950/55 p-3" aria-label="Media location" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
          <LocateFixed size={14} aria-hidden="true" /> Location
        </p>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClass}`}>{badge}</span>
      </div>

      {hasCoordinates ? (
        <dl className={`mt-3 grid gap-2 text-[11px] ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="mt-0.5 break-words leading-5 text-slate-200">
              {location.formattedAddress && location.formattedAddress !== "Address unavailable"
                ? location.formattedAddress
                : "Address unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Coordinates</dt>
            <dd className="mt-0.5 break-all font-mono text-slate-200">{Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Accuracy</dt>
            <dd className="mt-0.5 text-slate-200">{location.accuracyMeters ? `±${Math.round(Number(location.accuracyMeters))} metres` : "Not available"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Captured</dt>
            <dd className="mt-0.5 text-slate-200">{formatDateTime(location.capturedAt)}</dd>
          </div>
        </dl>
      ) : <p className="mt-2 text-[11px] text-slate-400">{location?.recorded ? "Exact location is restricted for your role." : "Location not recorded."}</p>}

      {(onRetryGps || (hasCoordinates && onRefreshAddress) || mapUrl || (canRemove && onRemove)) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetryGps ? <button type="button" onClick={onRetryGps} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-[11px] text-slate-200"><RefreshCw size={12} /> Retry Location</button> : null}
          {hasCoordinates && onRefreshAddress ? <button type="button" onClick={onRefreshAddress} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-cyan-300/20 px-3 py-2 text-[11px] text-cyan-100"><RefreshCw size={12} /> Refresh Address</button> : null}
          {mapUrl ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-emerald-300/20 px-3 py-2 text-[11px] text-emerald-100"><ExternalLink size={12} /> Open Location</a> : null}
          {canRemove && onRemove ? <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 px-2 py-1 text-[11px] text-rose-200"><Trash2 size={12} /> Remove Location</button> : null}
        </div>
      ) : null}
    </section>
  );
};

export default MediaLocationCard;
