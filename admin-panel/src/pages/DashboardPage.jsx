import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  Construction,
  GraduationCap,
  HardHat,
  ShieldCheck,
  Siren,
  TriangleAlert,
  UsersRound,
  Wrench
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import GlassCard from "../components/common/GlassCard";
import KPIBox from "../components/dashboard/KPIBox";
import SafeChartContainer from "../components/common/SafeChartContainer";
import SectionHeader from "../components/common/SectionHeader";
import SkeletonBlock from "../components/common/SkeletonBlock";
import { dashboardService } from "../api/services";
import { enterpriseHseService } from "../api/enterpriseHse";
import { isDeprecatedHseModule } from "../config/enterpriseHseConfig";
import { formatDateTime } from "../utils/format";

const REFRESH_INTERVAL_MS = 60000;

// The dashboard used to seed itself from a hard-coded demo dataset (186 users,
// 26 open hazards, ...) and fall back to it whenever the summary API failed.
// On a live safety portal that renders invented figures as real KPIs, so the
// starting state is now an honest empty shape and a failed refresh keeps the
// last real snapshot plus a visible warning.
const EMPTY_SUMMARY = Object.freeze({
  kpis: {},
  charts: { workStatus: [], hazardStatus: [], monthlyTrend: [], userActivity: [], safetyPerformanceScore: 0 },
  assignedTasks: { counts: {}, total: 0, items: [] },
  alerts: [],
  activities: []
});

const workColors = ["#F59E0B", "#22C55E", "#06B6D4", "#F43F5E"];
const hazardColor = "#2dd4bf";

const trendingModules = [
  {
    key: "work",
    title: "Work Approvals",
    desc: "Single-step approvals with evidence tracking",
    bg: "from-teal-500/30 to-cyan-500/20"
  },
  {
    key: "hazards",
    title: "Hazard Control",
    desc: "Risk matrix, actions, closure intelligence",
    bg: "from-amber-500/30 to-orange-500/20"
  },
  {
    key: "training",
    title: "Training Hub",
    desc: "Safety training videos, documents, assessments, and certificates",
    bg: "from-sky-500/30 to-indigo-500/20"
  },
  {
    key: "incidents",
    title: "Report an Incident",
    desc: "Investigation, root cause, actions, and verification",
    bg: "from-rose-500/30 to-orange-500/20"
  },
  {
    key: "permits",
    title: "Create a Permit",
    desc: "Control high-risk work from review through close-out",
    bg: "from-amber-500/30 to-yellow-500/20"
  }
];

const DashboardPage = ({ onModuleSelect }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [enterprise, setEnterprise] = useState({ kpis: {}, modules: [], alerts: [] });

  const fetchSummary = useCallback(async () => {
    // Three summary endpoints, all server-aggregated. The dashboard never
    // downloads module records — see the guard in dashboardService.summary().
    try {
      const [response, hseDashboard, hseAlerts] = await Promise.all([
        dashboardService.summary(),
        enterpriseHseService.dashboard().catch(() => ({ kpis: {}, modules: [] })),
        enterpriseHseService.alerts().catch(() => ({ alerts: [] }))
      ]);
      setSummary(response);
      // The /hse endpoints aggregate across every collection, including the
      // retired ones whose data still exists. Filtering here stops a retired
      // module surfacing as a chart bar or as an alert that routes nowhere.
      setEnterprise({
        ...hseDashboard,
        modules: (hseDashboard.modules || []).filter((item) => !isDeprecatedHseModule(item.key)),
        alerts: (hseAlerts.alerts || []).filter((item) => !isDeprecatedHseModule(item.module))
      });
      setLoadError("");
    } catch (_error) {
      // Keep the last good snapshot on screen rather than blanking the page.
      setLoadError("Live figures are temporarily unavailable. Showing the last known snapshot.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let poll = null;

    // Only the recurring poll is gated on visibility. The first load must always
    // run: a dashboard opened in a background tab (restored session, middle-click
    // from a notification, second monitor) otherwise sat on skeletons until the
    // user happened to focus it.
    const safeFetch = async ({ force = false } = {}) => {
      if (!active) return;
      if (document.hidden && !force) return;
      await fetchSummary();
    };

    // Refresh on a 60s cadence rather than 30s, and only while the tab is
    // actually visible — a background tab used to keep three aggregation
    // queries running against MongoDB every 30 seconds per open session.
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(safeFetch, REFRESH_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (!poll) return;
      clearInterval(poll);
      poll = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      safeFetch();
      startPolling();
    };

    safeFetch({ force: true });
    startPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchSummary]);

  const kpis = summary.kpis || {};
  const charts = summary.charts || {};
  const alerts = summary.alerts || [];
  const assignedTasks = summary.assignedTasks || { counts: {}, total: 0, items: [] };
  const hseKpis = enterprise.kpis || {};
  // Read once on mount. This used to run `JSON.parse(localStorage...)` on every
  // render and hand a fresh array to the memo below, so `compactActivities`
  // re-sorted the whole list on each render of the page.
  const localActivities = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(localStorage.getItem("hse_local_activities") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (_error) {
      return [];
    }
  }, []);

  const compactActivities = useMemo(() => {
    const merged = [...(summary.activities || []), ...localActivities];
    const activityList = merged.filter((item) => {
      const message = `${item?.message || ""}`.toLowerCase();
      if (message.includes("login")) return true;
      if (message.includes("approved")) return true;
      if (message.includes("closed")) return true;
      if (message.includes("export")) return true;
      return ["users", "work", "hazards", "reports"].includes(item?.module);
    });
    return activityList
      .sort((a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0))
      .slice(0, 10);
  }, [summary.activities, localActivities]);

  return (
    <div className="safety-bg-overlay safety-bg-dashboard space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-hero relative overflow-hidden rounded-[2rem] border border-white/12 p-6 md:p-10"
      >
        <div className="relative z-10">
          <p className="brand-accent-text text-xs uppercase tracking-[0.3em]">HSE Intelligence Hub</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-white md:text-5xl">
            Command Center for Safety Compliance, Operations, and Risk Governance
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-200 md:text-base">
            Live approvals, hazard control, training completion, and security telemetry in a
            unified enterprise cockpit.
          </p>
        </div>
      </motion.section>

      <SectionHeader
        title="Operations &amp; Safety KPIs"
        subtitle="Live work approval, hazard, training and user metrics"
      />

      {loadError ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100"
        >
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {alerts.map((alert) => (
            <button
              key={`${alert.type}-${alert.title}`}
              type="button"
              onClick={() => onModuleSelect?.(alert.module)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                alert.priority === "urgent"
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                  : alert.priority === "high"
                  ? "border-orange-400/30 bg-orange-500/10 text-orange-100"
                  : "border-sky-400/30 bg-sky-500/10 text-sky-100"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-current/70">Dashboard Alert</p>
              <p className="mt-1 text-sm font-semibold">{alert.title}</p>
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KPIBox
            title="Total Users"
            value={kpis.totalUsers}
            icon={UsersRound}
            backgroundIcon={HardHat}
            gradient="from-teal-500/35 via-cyan-600/20 to-slate-950/70"
            accent="text-teal-200"
            delay={0}
          />
          <KPIBox
            title="Active Users"
            value={kpis.activeUsers}
            icon={ShieldCheck}
            backgroundIcon={UsersRound}
            gradient="from-sky-500/35 via-blue-600/20 to-slate-950/70"
            accent="text-sky-200"
            delay={0.04}
          />
          <KPIBox
            title="Total Work Approvals"
            value={kpis.totalWorkApprovals}
            icon={HardHat}
            backgroundIcon={Wrench}
            gradient="from-cyan-500/35 via-sky-600/20 to-slate-950/70"
            accent="text-cyan-200"
            delay={0.08}
          />
          <KPIBox
            title="Pending Work"
            value={kpis.pendingWork}
            icon={Clock3}
            backgroundIcon={ClipboardCheck}
            gradient="from-orange-500/35 via-amber-600/20 to-slate-950/70"
            accent="text-amber-200"
            delay={0.12}
          />
          <KPIBox
            title="Approved Work"
            value={kpis.approvedWork}
            icon={ClipboardCheck}
            backgroundIcon={HardHat}
            gradient="from-emerald-500/35 via-teal-600/20 to-slate-950/70"
            accent="text-emerald-200"
            delay={0.16}
          />
          <KPIBox
            title="Completed Work"
            value={kpis.completedWork}
            icon={CircleCheckBig}
            backgroundIcon={Construction}
            gradient="from-indigo-500/35 via-blue-600/20 to-slate-950/70"
            accent="text-indigo-200"
            delay={0.2}
          />
          <KPIBox
            title="Partially Completed"
            value={kpis.partiallyCompleted}
            icon={Construction}
            backgroundIcon={Wrench}
            gradient="from-lime-500/35 via-emerald-700/20 to-slate-950/70"
            accent="text-lime-200"
            delay={0.22}
          />
          <KPIBox
            title="Pending Check"
            value={kpis.pendingCheck}
            icon={ClipboardCheck}
            backgroundIcon={HardHat}
            gradient="from-cyan-500/30 via-sky-700/20 to-slate-950/70"
            accent="text-cyan-100"
            delay={0.24}
          />
          <KPIBox
            title="Pending Recommendation"
            value={kpis.pendingRecommendation}
            icon={Clock3}
            backgroundIcon={ShieldCheck}
            gradient="from-violet-500/30 via-indigo-700/20 to-slate-950/70"
            accent="text-violet-100"
            delay={0.26}
          />
          <KPIBox
            title="Pending Final Approval"
            value={kpis.pendingFinalApproval}
            icon={ShieldCheck}
            backgroundIcon={ClipboardCheck}
            gradient="from-amber-500/30 via-orange-700/20 to-slate-950/70"
            accent="text-amber-100"
            delay={0.28}
          />
          <KPIBox
            title="Work In Progress"
            value={kpis.workInProgress}
            icon={Wrench}
            backgroundIcon={Construction}
            gradient="from-blue-500/30 via-cyan-700/20 to-slate-950/70"
            accent="text-blue-100"
            delay={0.3}
          />
          <KPIBox
            title="Returned for Correction"
            value={kpis.returnedForCorrection}
            icon={TriangleAlert}
            backgroundIcon={ClipboardCheck}
            gradient="from-rose-500/30 via-red-800/20 to-slate-950/70"
            accent="text-rose-100"
            delay={0.32}
          />
          <KPIBox
            title="Total Hazards"
            value={kpis.totalHazards}
            icon={TriangleAlert}
            backgroundIcon={Siren}
            gradient="from-rose-500/35 via-red-600/20 to-slate-950/70"
            accent="text-rose-200"
            delay={0.34}
          />
          <KPIBox
            title="Open Hazards"
            value={kpis.openHazards}
            icon={Siren}
            backgroundIcon={TriangleAlert}
            gradient="from-orange-500/35 via-rose-600/20 to-slate-950/70"
            accent="text-orange-200"
            delay={0.36}
          />
          <KPIBox
            title="Closed Hazards"
            value={kpis.closedHazards}
            icon={ShieldCheck}
            backgroundIcon={TriangleAlert}
            gradient="from-green-500/35 via-emerald-600/20 to-slate-950/70"
            accent="text-green-200"
            delay={0.38}
          />
          <KPIBox
            title="Training Records"
            value={kpis.trainingRecords}
            icon={GraduationCap}
            backgroundIcon={HardHat}
            gradient="from-cyan-400/35 via-indigo-600/20 to-slate-950/70"
            accent="text-cyan-100"
            delay={0.4}
          />
        </div>
      )}

      <SectionHeader
        title="Enterprise HSE Performance"
        subtitle="Server-calculated incident, observation, action, permit, and expiry indicators"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KPIBox title="Incidents - 30 Days" value={hseKpis.incidentsLast30Days || 0} icon={TriangleAlert} backgroundIcon={Siren} gradient="from-rose-500/35 via-red-700/20 to-slate-950/70" accent="text-rose-100" />
        <KPIBox title="Safe Observation Rate" value={hseKpis.safeObservationRate || 0} hint="Percent" icon={ShieldCheck} backgroundIcon={ClipboardCheck} gradient="from-emerald-500/35 via-teal-700/20 to-slate-950/70" accent="text-emerald-100" delay={0.03} />
        <KPIBox title="Overdue CAPA" value={hseKpis.overdueCapa || 0} icon={Clock3} backgroundIcon={TriangleAlert} gradient="from-orange-500/35 via-amber-700/20 to-slate-950/70" accent="text-orange-100" delay={0.06} />
        <KPIBox title="Active Permits" value={hseKpis.activePermits || 0} icon={ClipboardCheck} backgroundIcon={HardHat} gradient="from-cyan-500/35 via-sky-700/20 to-slate-950/70" accent="text-cyan-100" delay={0.09} />
        <KPIBox title="High-Risk Open" value={hseKpis.highRiskOpen || 0} icon={Siren} backgroundIcon={TriangleAlert} gradient="from-fuchsia-500/30 via-rose-800/20 to-slate-950/70" accent="text-fuchsia-100" delay={0.12} />
        <KPIBox title="Expiring Items" value={hseKpis.expiringItems || 0} icon={Clock3} backgroundIcon={ClipboardCheck} gradient="from-violet-500/30 via-indigo-800/20 to-slate-950/70" accent="text-violet-100" delay={0.15} />
        <KPIBox title="Inspection Compliance" value={hseKpis.inspectionComplianceRate || 0} hint="Percent" icon={ClipboardCheck} backgroundIcon={ShieldCheck} gradient="from-teal-500/30 via-emerald-800/20 to-slate-950/70" accent="text-teal-100" delay={0.18} />
        <KPIBox title="Toolbox Talks" value={hseKpis.toolboxThisMonth || 0} hint="This month" icon={HardHat} backgroundIcon={UsersRound} gradient="from-sky-500/30 via-cyan-800/20 to-slate-950/70" accent="text-sky-100" delay={0.21} />
        <KPIBox title="PPE Attention" value={hseKpis.ppeDue || 0} icon={HardHat} backgroundIcon={TriangleAlert} gradient="from-amber-500/30 via-yellow-800/20 to-slate-950/70" accent="text-amber-100" delay={0.24} />
        <KPIBox title="Contractors Expiring" value={hseKpis.contractorExpiring || 0} icon={Construction} backgroundIcon={Clock3} gradient="from-orange-500/30 via-amber-800/20 to-slate-950/70" accent="text-orange-100" delay={0.27} />
        <KPIBox title="Open Emergencies" value={hseKpis.emergencyOpen || 0} icon={Siren} backgroundIcon={TriangleAlert} gradient="from-red-500/30 via-rose-900/20 to-slate-950/70" accent="text-red-100" delay={0.3} />
        <KPIBox title="Documents Expiring" value={hseKpis.documentExpiring || 0} icon={ClipboardCheck} backgroundIcon={Clock3} gradient="from-indigo-500/30 via-violet-900/20 to-slate-950/70" accent="text-indigo-100" delay={0.33} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <GlassCard className="p-5 md:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Module Workload and Overdue Actions</h3>
          <SafeChartContainer height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(enterprise.modules || []).filter((item) => item.total > 0).slice(0, 12)} margin={{ left: 4, right: 8, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#cbd5e1" angle={-35} textAnchor="end" interval={0} height={90} tick={{ fontSize: 10 }} />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" fill="#06B6D4" radius={[5, 5, 0, 0]} />
                <Bar dataKey="overdue" name="Overdue" fill="#F43F5E" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>
        <GlassCard className="p-5 md:p-6">
          <h3 className="text-lg font-semibold text-white">Priority Alerts</h3>
          <p className="mt-1 text-xs text-slate-400">Overdue, expiring, urgent, and critical records</p>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {(enterprise.alerts || []).slice(0, 12).map((alert) => (
              <button key={`${alert.module}-${alert._id}`} type="button" onClick={() => onModuleSelect?.(alert.module)} className="w-full rounded-2xl border border-rose-300/15 bg-rose-500/[0.06] p-3 text-left transition hover:bg-rose-500/10">
                <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-rose-200">{alert.moduleLabel}</span><span className="text-[10px] text-slate-500">{alert.recordId}</span></div>
                <p className="mt-1 text-sm font-semibold text-white">{alert.title}</p>
                <p className="mt-1 text-xs text-slate-400">{alert.status} {alert.dueDate ? `- due ${new Date(alert.dueDate).toLocaleDateString("en-IN")}` : ""}</p>
              </button>
            ))}
            {!enterprise.alerts?.length ? <p className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.06] p-4 text-sm text-emerald-100">No enterprise HSE alerts require attention.</p> : null}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard className="p-5 md:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Work Status Pie Chart</h3>
          <SafeChartContainer height={288}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.workStatus || []}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {(charts.workStatus || []).map((entry, index) => (
                    <Cell key={entry.name} fill={workColors[index % workColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Hazard Status Bar Chart</h3>
          <SafeChartContainer height={288}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.hazardStatus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Bar dataKey="value" fill={hazardColor} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Monthly Trend Graph</h3>
          <SafeChartContainer height={288}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="work" stroke="#14B8A6" strokeWidth={3} />
                <Line type="monotone" dataKey="hazards" stroke="#F59E0B" strokeWidth={3} />
                <Line
                  type="monotone"
                  dataKey="trainingCompletions"
                  stroke="#38BDF8"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">User Activity Graph</h3>
          <SafeChartContainer height={288}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.userActivity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="logins"
                  stroke="#38BDF8"
                  fill="url(#activityGradient)"
                  strokeWidth={3}
                />
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="p-6 xl:col-span-1">
          <SectionHeader
            title="Assigned To Me"
            subtitle="Pending check, recommendation, final approval, returned, and completion tasks"
          />
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Pending Check", assignedTasks.counts?.pendingCheck || 0, "work"],
              ["Pending Recommendation", assignedTasks.counts?.pendingRecommendation || 0, "work"],
              ["Pending Final Approval", assignedTasks.counts?.pendingApproval || 0, "work"],
              ["Returned", assignedTasks.counts?.returnedWork || 0, "work"],
              ["Work In Progress", assignedTasks.counts?.incompleteWork || 0, "work"]
            ].map(([label, value, module]) => (
              <button
                key={label}
                type="button"
                onClick={() => onModuleSelect?.(module)}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
              >
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {(assignedTasks.items || []).length === 0 ? (
              <p className="text-xs text-slate-400">No assigned tasks currently pending.</p>
            ) : (
              assignedTasks.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onModuleSelect?.("work")}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.location}</p>
                    </div>
                    <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2 py-1 text-[10px] text-orange-100">
                      {item.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6 xl:col-span-1">
          <h3 className="mb-4 text-lg font-semibold text-white">Safety Performance Score</h3>
          <SafeChartContainer height={256}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="90%"
                barSize={16}
                data={[{ name: "score", value: charts.safetyPerformanceScore || 0 }]}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} fill="#2dd4bf" />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-4xl font-semibold"
                >
                  {`${charts.safetyPerformanceScore || 0}%`}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </SafeChartContainer>
        </GlassCard>

        <GlassCard className="p-6 xl:col-span-1">
          <SectionHeader
            title="Recent Activities Panel"
            subtitle="Latest 10 activities: logins, approvals, closures, and exports"
          />
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {compactActivities.map((activity, index) => (
              <div
                key={activity.id || activity._id || `${activity.message}-${index}`}
                className="relative rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.9)]" />
                <div className="ml-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{activity.message}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-teal-300">
                      {activity.module} • {activity.action}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-300">{formatDateTime(activity.timestamp)}</p>
                </div>
              </div>
            ))}
            {compactActivities.length === 0 ? (
              <p className="text-xs text-slate-300">No activities available yet.</p>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <SectionHeader
        title="Trending Modules"
        subtitle="Quick navigation cards for most active modules"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {trendingModules.map((module, index) => (
          <motion.button
            key={module.key}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
            whileHover={{ y: -5, scale: 1.01 }}
            onClick={() => onModuleSelect(module.key)}
            className="enterprise-card enterprise-card--interactive relative overflow-hidden rounded-3xl border border-white/12 bg-slate-950/55 p-6 text-left"
          >
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${module.bg}`} aria-hidden="true" />
            <h4 className="relative z-10 font-display text-lg font-semibold text-white">{module.title}</h4>
            <p className="relative z-10 mt-2 text-sm leading-relaxed text-slate-300">{module.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
