import { useCallback, useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import GlassCard from "../components/common/GlassCard";
import SectionHeader from "../components/common/SectionHeader";
import { reportService, trainingService } from "../api/services";
import { showSuccessPopup } from "../utils/alerts";
import { exportReportPdf, normalizeReportRowsByType } from "../utils/pdfExport";
import companyLogo from "../assets/logo.png";

const periods = ["daily", "weekly", "monthly", "yearly"];
const reportTypes = [
  { value: "work", label: "Work Report" },
  { value: "hazard", label: "Hazard Report" },
  { value: "training", label: "Training Report" },
  { value: "date", label: "Date-wise Hazards" },
  { value: "user", label: "User-wise Hazards" },
  { value: "approved", label: "Approved Work" }
];

const plazaOptions = ["", "Sasthan Plaza", "Hejamadi Plaza", "Talapady Plaza", "Site"];
const companyName = "Sasthan Udupi Tollway Pvt Ltd";

const reportTitleMap = {
  work: "Work Report",
  hazard: "Hazard Report",
  training: "Training Report",
  date: "Date-wise Hazards",
  user: "User-wise Hazards",
  approved: "Approved Work Report"
};

const logReportExport = (format, reportType) => {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem("hse_local_activities");
  const list = raw ? JSON.parse(raw) : [];
  const next = [
    {
      id: `report-${Date.now()}`,
      module: "reports",
      action: "Exported",
      message: `${reportTitleMap[reportType] || "Report"} exported as ${format.toUpperCase()}`,
      timestamp: new Date().toISOString()
    },
    ...list
  ].slice(0, 30);
  localStorage.setItem("hse_local_activities", JSON.stringify(next));
};

const ReportsPage = () => {
  const [period, setPeriod] = useState("monthly");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [type, setType] = useState("work");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [plaza, setPlaza] = useState("");
  const [reportRows, setReportRows] = useState([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.analytics(period);
      setAnalytics(response.analytics);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    setReportRows([]);
  }, [type, fromDate, toDate, plaza]);

  const generateReport = async () => {
    setError("");
    try {
      let rows = [];
      if (type === "training") {
        const response = await trainingService.list();
        rows = (response.records || []).map((item) => ({
          "Training Title": item.title || "-",
          Trainer:
            item.trainer ||
            item.uploadedBy?.name ||
            item.createdBy?.name ||
            item.author ||
            "Training Team",
          Category: item.category || "General",
          "Uploaded Date": item.createdAt || "-",
          Status: item.status || "Published"
        }));
      } else {
        rows = await reportService.generateLegacyReport({
          type,
          fromDate,
          toDate,
          plaza
        });
      }
      setReportRows(rows || []);
    } catch (_error) {
      setError("Error generating report");
    }
  };

  const workStatusData = useMemo(() => {
    const counts = {};
    (analytics?.workTrends || []).forEach((item) => {
      counts[item.status || "Pending"] = (counts[item.status || "Pending"] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const exportExcel = () => {
    if (!reportRows.length) return;
    const generatedDate = new Date().toLocaleString();
    const normalized =
      type === "work" || type === "hazard" || type === "training"
        ? normalizeReportRowsByType(reportRows, type)
        : reportRows;
    const headers = Object.keys(normalized[0] || {});
    const rows = normalized.map((row) => headers.map((header) => row[header] ?? "-"));
    const metadataRows = [
      [companyName],
      ["Safety HSE Enterprise System"],
      [reportTitleMap[type] || "Report"],
      [`Generated: ${generatedDate}`],
      ["Logo: src/assets/logo.png"],
      [],
      headers
    ];

    const ws = XLSX.utils.aoa_to_sheet(metadataRows);
    XLSX.utils.sheet_add_aoa(ws, rows, { origin: `A${metadataRows.length + 1}` });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${type}_report.xlsx`);
    logReportExport("excel", type);
    void showSuccessPopup("Report Exported Successfully", "Excel report downloaded");
  };

  const exportCsv = () => {
    if (!reportRows.length) return;
    const generatedDate = new Date().toLocaleString();
    const normalized =
      type === "work" || type === "hazard" || type === "training"
        ? normalizeReportRowsByType(reportRows, type)
        : reportRows;
    const headers = Object.keys(normalized[0] || {});
    const rows = normalized.map((row) => headers.map((header) => row[header] ?? "-"));
    const ws = XLSX.utils.aoa_to_sheet([
      [companyName],
      ["Safety HSE Enterprise System"],
      [reportTitleMap[type] || "Report"],
      [`Generated: ${generatedDate}`],
      [],
      headers,
      ...rows
    ]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${type}_report.csv`);
    logReportExport("csv", type);
    void showSuccessPopup("Report Exported Successfully", "CSV report downloaded");
  };

  const exportPdf = () => {
    if (!reportRows.length) return;
    let activeUser = localStorage.getItem("name") || "Admin";
    try {
      activeUser = JSON.parse(localStorage.getItem("hse_user") || "null")?.name || activeUser;
    } catch (_error) {
      // Keep local storage fallback user name.
    }
    const safeType = type === "hazard" || type === "training" ? type : "work";
    exportReportPdf({
      rows: reportRows,
      type: safeType,
      reportTitle: reportTitleMap[type] || "Report",
      companyName,
      companyLogo,
      generatedBy: activeUser,
      generatedAt: new Date()
    });
    logReportExport("pdf", type);
    void showSuccessPopup("Report Exported Successfully", "PDF report downloaded");
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Enterprise Reporting & Analytics"
        subtitle="Legacy report workflows restored with enterprise analytics and export controls"
        actions={
          <div className="flex flex-wrap gap-2">
            {periods.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-xl px-3 py-1.5 text-xs ${
                  period === item
                    ? "bg-teal-500/30 text-teal-100"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        }
      />

      <GlassCard className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-white">Legacy Report Generator</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
          >
            {reportTypes.map((item) => (
              <option key={item.value} value={item.value} className="bg-slate-900 text-white">
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
          />
          <select
            value={plaza}
            onChange={(event) => setPlaza(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
          >
            {plazaOptions.map((item) => (
              <option key={item || "all"} value={item} className="bg-slate-900 text-white">
                {item || "All Plazas"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generateReport}
            className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white"
          >
            Generate Report
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
          >
            Export PDF
          </button>
        </div>
      </GlassCard>

      {reportRows.length > 0 ? (
        <GlassCard className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-white">Report Preview</h3>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  {Object.keys(reportRows[0]).map((header) => (
                    <th key={header} className="py-2 pr-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={`row-${idx}`} className="border-b border-white/5 text-slate-200">
                    {Object.keys(reportRows[0]).map((header) => (
                      <td key={`${idx}-${header}`} className="py-2 pr-3">
                        {row[header] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      {loading ? (
        <GlassCard className="p-5">
          <p className="text-sm text-slate-300">Loading analytics...</p>
        </GlassCard>
      ) : analytics ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <GlassCard className="p-4" hover={false}>
              <p className="text-xs text-slate-300">Work Trends</p>
              <p className="mt-1 text-2xl font-semibold text-white">{analytics.totals.work}</p>
            </GlassCard>
            <GlassCard className="p-4" hover={false}>
              <p className="text-xs text-slate-300">Hazard Trends</p>
              <p className="mt-1 text-2xl font-semibold text-white">{analytics.totals.hazards}</p>
            </GlassCard>
            <GlassCard className="p-4" hover={false}>
              <p className="text-xs text-slate-300">User Performance</p>
              <p className="mt-1 text-2xl font-semibold text-white">{analytics.totals.users}</p>
            </GlassCard>
            <GlassCard className="p-4" hover={false}>
              <p className="text-xs text-slate-300">Safety KPI</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {analytics.safetyKpis.workCompletionRate}%
              </p>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <GlassCard className="p-5">
              <h3 className="mb-3 text-lg font-semibold text-white">Work Status Distribution</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#14B8A6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 text-lg font-semibold text-white">Hazard Severity Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.hazardTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="createdAt"
                      stroke="#cbd5e1"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric"
                        })
                      }
                    />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="riskScore" stroke="#F59E0B" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
};

export default ReportsPage;
