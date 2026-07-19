import { useEffect, useMemo, useState } from "react";
import { Activity, Database, HardDrive, Mail, RefreshCw, Server, ShieldCheck, UploadCloud } from "lucide-react";
import GlassCard from "../components/common/GlassCard";
import PageHeader from "../components/common/PageHeader";
import { healthService } from "../api/services";

const checkLabels = {
  backend: "Backend Status",
  mongodb: "MongoDB Status",
  uploadService: "Upload Service Status",
  emailService: "Email Service Status",
  storage: "Storage Status"
};

const checkIcons = {
  backend: Server,
  mongodb: Database,
  uploadService: UploadCloud,
  emailService: Mail,
  storage: HardDrive
};

const goodStatuses = new Set(["ok", "connected", "cloudinary_configured", "local_storage_ready", "configured", "writable", "ready"]);
const warningStatuses = new Set(["not_configured", "manual", "local", "degraded", "attention_required"]);

const formatStatus = (value) =>
  String(value ?? "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (goodStatuses.has(normalized)) return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  if (warningStatuses.has(normalized)) return "border-amber-400/25 bg-amber-500/10 text-amber-100";
  return "border-rose-400/25 bg-rose-500/10 text-rose-100";
};

const StatusPill = ({ value }) => (
  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(value)}`}>
    {formatStatus(value)}
  </span>
);

const Metric = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold text-white">{value ?? "-"}</p>
  </div>
);

const SystemHealthPage = () => {
  const [health, setHealth] = useState(null);
  const [backup, setBackup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backupError, setBackupError] = useState("");

  const runtime = useMemo(
    () => [
      { label: "Environment", value: health?.environment },
      { label: "Build Version", value: health?.buildVersion },
      { label: "API Version", value: health?.apiVersion },
      { label: "Active Sessions", value: health?.activeSessions ?? "-" },
      { label: "Email Queue", value: health?.emailQueue?.queued ?? "-" },
      { label: "Uptime Seconds", value: health?.uptimeSeconds ?? "-" },
      { label: "Timestamp", value: health?.timestamp ? new Date(health.timestamp).toLocaleString() : "-" }
    ],
    [health]
  );

  const loadHealth = async () => {
    setLoading(true);
    setError("");
    setBackupError("");
    try {
      const [healthResponse, backupResponse] = await Promise.allSettled([
        healthService.get(),
        healthService.backupReadiness()
      ]);

      if (healthResponse.status === "fulfilled") {
        setHealth(healthResponse.value);
      } else {
        setError(healthResponse.reason?.response?.data?.message || "Unable to load system health");
      }

      if (backupResponse.status === "fulfilled") {
        setBackup(backupResponse.value);
      } else {
        setBackup(null);
        setBackupError(backupResponse.reason?.response?.data?.message || "Unable to load backup readiness");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="System Health"
          subtitle="Backend, database, upload, email, storage, session, and backup status"
        />
        <button
          type="button"
          onClick={loadHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl border border-white/10 bg-white/10 p-3 text-teal-100">
              <Activity size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">API Runtime</h3>
              <p className="text-xs text-slate-400">{health?.service || "Safety Management System API"}</p>
            </div>
          </div>
          <StatusPill value={health?.status || (loading ? "loading" : "unavailable")} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {runtime.map((item) => (
            <Metric key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {Object.entries(checkLabels).map(([key, label]) => {
          const Icon = checkIcons[key] || ShieldCheck;
          const value = health?.checks?.[key] || (loading ? "loading" : "unavailable");
          return (
            <GlassCard key={key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-2xl border border-white/10 bg-white/10 p-2.5 text-cyan-100">
                  <Icon size={17} />
                </span>
                <StatusPill value={value} />
              </div>
              <p className="mt-4 text-sm font-semibold text-white">{label}</p>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Backup Readiness</h3>
            <p className="text-xs text-slate-400">
              Provider: {backup?.backupProvider || "-"} - Retention: {backup?.retentionDays || "-"} days
            </p>
          </div>
          <StatusPill value={backup?.success ? "ready" : backupError ? "attention_required" : "loading"} />
        </div>

        {backupError ? <p className="mt-3 text-sm text-amber-300">{backupError}</p> : null}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(backup?.targets || {}).map(([key, target]) => (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold capitalize text-white">{key.replace(/([A-Z])/g, " $1")}</p>
                <StatusPill value={target.status} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                {target.source || target.provider || target.recommendedStrategy || "-"}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default SystemHealthPage;
