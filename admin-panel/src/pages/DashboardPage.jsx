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
import { mockSummary } from "../data/mock";
import { formatDateTime } from "../utils/format";

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
    desc: "Access Safety Training Videos, Documents, and Learning Resources ✅",
    bg: "from-sky-500/30 to-indigo-500/20"
  }
];

const DashboardPage = ({ onModuleSelect }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(mockSummary);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await dashboardService.summary();
      setSummary(response);
    } catch (_error) {
      setSummary(mockSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const safeFetch = async () => {
      try {
        if (!active || document.hidden) return;
        await fetchSummary();
      } catch (_error) {
        if (!active) return;
        // Dashboard silently falls back to latest known snapshot.
      }
    };

    safeFetch();
    const poll = setInterval(safeFetch, 30000);
    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [fetchSummary]);

  const kpis = summary.kpis || {};
  const charts = summary.charts || {};
  const alerts = summary.alerts || [];
  const assignedTasks = summary.assignedTasks || { counts: {}, total: 0, items: [] };
  const localActivities = (() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(localStorage.getItem("hse_local_activities") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (_error) {
      return [];
    }
  })();

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
        className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-r from-slate-900/90 via-teal-900/40 to-sky-900/40 p-6 md:p-10"
      >
        <div className="absolute -right-14 -top-20 h-52 w-52 rounded-full bg-teal-400/40 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.3em] text-teal-200">HSE Intelligence Hub</p>
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
        title="Real-Time KPI Dashboard"
        subtitle="Live operational and safety metrics across enterprise modules"
      />

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
            title="Total Hazards"
            value={kpis.totalHazards}
            icon={TriangleAlert}
            backgroundIcon={Siren}
            gradient="from-rose-500/35 via-red-600/20 to-slate-950/70"
            accent="text-rose-200"
            delay={0.24}
          />
          <KPIBox
            title="Open Hazards"
            value={kpis.openHazards}
            icon={Siren}
            backgroundIcon={TriangleAlert}
            gradient="from-orange-500/35 via-rose-600/20 to-slate-950/70"
            accent="text-orange-200"
            delay={0.28}
          />
          <KPIBox
            title="Closed Hazards"
            value={kpis.closedHazards}
            icon={ShieldCheck}
            backgroundIcon={TriangleAlert}
            gradient="from-green-500/35 via-emerald-600/20 to-slate-950/70"
            accent="text-green-200"
            delay={0.32}
          />
          <KPIBox
            title="Training Records"
            value={kpis.trainingRecords}
            icon={GraduationCap}
            backgroundIcon={HardHat}
            gradient="from-cyan-400/35 via-indigo-600/20 to-slate-950/70"
            accent="text-cyan-100"
            delay={0.36}
          />
        </div>
      )}

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
            className={`relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br ${module.bg} p-6 text-left`}
          >
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <h4 className="relative z-10 font-display text-xl font-semibold text-white">
              {module.title}
            </h4>
            <p className="relative z-10 mt-2 text-sm text-slate-200">{module.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
