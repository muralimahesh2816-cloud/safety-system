import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import SafeChartContainer from "../components/common/SafeChartContainer";
import PageHeader from "../components/common/PageHeader";
import { reportService, trainingService } from "../api/services";
import { closeLoadingPopup, showLoadingPopup, showSuccessPopup } from "../utils/alerts";
import { exportReportPdf, normalizeReportRowsByType } from "../utils/pdfExport";
import { loadFileSaver, loadXlsx } from "../utils/lazyVendor";
import companyLogo from "../assets/vertis-logo.svg";
import { APP_NAME, ORGANIZATION_NAME } from "../config/appConfig";

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
const companyName = ORGANIZATION_NAME;

const reportTitleMap = {
  work: "Work Report",
  hazard: "Hazard Report",
  training: "Training Report",
  date: "Date-wise Hazards",
  user: "User-wise Hazards",
  approved: "Approved Work Report"
};

const reportStatusTone = (value) => {
  const status = String(value || "").toLowerCase();
  if (["completed", "closed", "published", "approved"].includes(status)) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  if (["rejected", "critical", "open"].includes(status)) {
    return "border-rose-400/30 bg-rose-500/15 text-rose-200";
  }
  return "border-amber-400/30 bg-amber-500/15 text-amber-200";
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
  const [busyAction, setBusyAction] = useState("");
  const actionLockRef = useRef(false);

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
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction("generate");
    setError("");
    await showLoadingPopup("Uploading Please Wait...", "Generating report...");
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
          Duration: item.durationMinutes ? `${item.durationMinutes} min` : "-",
          // The list endpoint now returns an aggregate count and only the
          // caller's own completion entry (see toTrainingListItem on the
          // backend); the array form is the pre-upgrade fallback.
          Completions:
            item.completedCount ?? (item.completions || []).filter((entry) => entry.isCompleted).length,
          "Uploaded Date": item.createdAt || "-",
          Status: item.isPublished === false ? "Draft" : item.status || "Published"
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
      await showSuccessPopup("Report Generated Successfully");
    } catch (_error) {
      setError("Error generating report");
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
      closeLoadingPopup();
    }
  };

  const workStatusData = useMemo(() => {
    const counts = {};
    (analytics?.workTrends || []).forEach((item) => {
      counts[item.status || "Pending"] = (counts[item.status || "Pending"] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const normalizedReportRows = useMemo(
    () => normalizeReportRowsByType(reportRows, type),
    [reportRows, type]
  );

  const exportExcel = async () => {
    if (!reportRows.length) return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction("excel");
    await showLoadingPopup("Uploading Please Wait...", "Preparing Excel report...");
    const generatedDate = new Date().toLocaleString();
    try {
      let generatedBy = localStorage.getItem("name") || "System";
      try {
        generatedBy = JSON.parse(localStorage.getItem("hse_user") || "null")?.name || generatedBy;
      } catch (_error) {
        // Keep the simple local storage fallback.
      }
      // SheetJS is code-split — see utils/lazyVendor.js.
      const XLSX = await loadXlsx();
      const normalized = normalizedReportRows;
      const headers = Object.keys(normalized[0] || {});
      const rows = normalized.map((row) => headers.map((header) => row[header] ?? "-"));
      const appliedDateRange = fromDate || toDate
        ? `${fromDate || "Beginning"} to ${toDate || "Today"}`
        : "All dates";
      const metadataRows = [
        [companyName],
        [APP_NAME],
        [reportTitleMap[type] || "Report"],
        [`Generated By: ${generatedBy}`],
        [`Generated: ${generatedDate}`],
        [`Applied Date Range: ${appliedDateRange}`],
        [],
        headers
      ];

      const ws = XLSX.utils.aoa_to_sheet(metadataRows);
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: `A${metadataRows.length + 1}` });
      const finalColumn = XLSX.utils.encode_col(Math.max(headers.length - 1, 0));
      ws["!merges"] = [0, 1, 2, 3, 4, 5].map((row) => ({
        s: { r: row, c: 0 },
        e: { r: row, c: Math.max(headers.length - 1, 0) }
      }));
      const workColumnWidths = [18, 20, 22, 26, 22, 22, 22, 14, 12, 22, 18, 22, 20, 22, 20, 16];
      ws["!cols"] = headers.map((header, index) => ({
        wch: type === "work"
          ? workColumnWidths[index]
          : Math.min(Math.max(header.length + 4, header.includes("Description") || header.includes("Action") ? 28 : 14), 38)
      }));
      const headerRowNumber = metadataRows.length;
      headers.forEach((_header, index) => {
        const cell = ws[XLSX.utils.encode_cell({ r: headerRowNumber - 1, c: index })];
        if (cell) cell.s = {
          fill: { fgColor: { rgb: "C60000" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
          alignment: { wrapText: true, vertical: "center" }
        };
      });
      ws["!autofilter"] = { ref: `A${headerRowNumber}:${finalColumn}${headerRowNumber + rows.length}` };
      ws["!freeze"] = { xSplit: 0, ySplit: headerRowNumber, topLeftCell: `A${headerRowNumber + 1}`, activePane: "bottomLeft", state: "frozen" };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${type}_report.xlsx`);
      logReportExport("excel", type);
      await showSuccessPopup("Report Exported Successfully", "Excel report downloaded");
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
      closeLoadingPopup();
    }
  };

  const exportCsv = async () => {
    if (!reportRows.length) return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction("csv");
    await showLoadingPopup("Uploading Please Wait...", "Preparing CSV report...");
    const generatedDate = new Date().toLocaleString();
    try {
      let generatedBy = localStorage.getItem("name") || "System";
      try {
        generatedBy = JSON.parse(localStorage.getItem("hse_user") || "null")?.name || generatedBy;
      } catch (_error) {
        // Keep the simple local storage fallback.
      }
      const [XLSX, saveAs] = await Promise.all([loadXlsx(), loadFileSaver()]);
      const normalized = normalizedReportRows;
      const headers = Object.keys(normalized[0] || {});
      const rows = normalized.map((row) => headers.map((header) => row[header] ?? "-"));
      const appliedDateRange = fromDate || toDate
        ? `${fromDate || "Beginning"} to ${toDate || "Today"}`
        : "All dates";
      const ws = XLSX.utils.aoa_to_sheet([
        [companyName],
        [APP_NAME],
        [reportTitleMap[type] || "Report"],
        [`Generated By: ${generatedBy}`],
        [`Generated: ${generatedDate}`],
        [`Applied Date Range: ${appliedDateRange}`],
        [],
        headers,
        ...rows
      ]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `${type}_report.csv`);
      logReportExport("csv", type);
      await showSuccessPopup("Report Exported Successfully", "CSV report downloaded");
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
      closeLoadingPopup();
    }
  };

  const exportPdf = async () => {
    if (!reportRows.length) return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction("pdf");
    await showLoadingPopup("Uploading Please Wait...", "Preparing PDF report...");
    let activeUser = localStorage.getItem("name") || "Admin";
    try {
      try {
        activeUser = JSON.parse(localStorage.getItem("hse_user") || "null")?.name || activeUser;
      } catch (_error) {
        // Keep local storage fallback user name.
      }
      await exportReportPdf({
        rows: reportRows,
        type,
        reportTitle: reportTitleMap[type] || "Report",
        companyName,
        companyLogo,
        generatedBy: activeUser,
        generatedAt: new Date()
      });
      logReportExport("pdf", type);
      await showSuccessPopup("Report Exported Successfully", "PDF report downloaded");
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
      closeLoadingPopup();
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
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
        <div className="report-filters grid grid-cols-1 gap-2 md:grid-cols-5">
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
            disabled={Boolean(busyAction)}
            className="hse-primary-button rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "generate" ? "Generating..." : "Generate Report"}
          </button>
        </div>
        <div className="report-actions mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={Boolean(busyAction) || !reportRows.length}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "excel" ? "Exporting..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={Boolean(busyAction) || !reportRows.length}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "csv" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={Boolean(busyAction) || !reportRows.length}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </GlassCard>

      {reportRows.length > 0 ? (
        <GlassCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-white/10 bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-rose-950/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-[0_0_28px_rgba(248,113,113,.12)]">
                <img src={companyLogo} alt="Udupi Tollway logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Udupi Tollway Pvt Ltd</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{reportTitleMap[type] || "Report"}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{APP_NAME}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Records</p>
              <p className="text-lg font-bold text-white">{normalizedReportRows.length}</p>
            </div>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[980px] table-auto text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-950/95 shadow-[0_8px_20px_rgba(0,0,0,.25)] backdrop-blur-xl">
                <tr className="border-b border-rose-400/20 text-slate-300">
                  {Object.keys(normalizedReportRows[0] || {}).map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-[0.08em]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {normalizedReportRows.map((row, idx) => (
                  <tr key={`row-${idx}`} className="border-b border-white/[0.06] text-slate-200 transition hover:bg-rose-500/[0.06] odd:bg-white/[0.018]">
                    {Object.keys(normalizedReportRows[0] || {}).map((header) => (
                      <td key={`${idx}-${header}`} className="max-w-[260px] px-4 py-3 align-top leading-5">
                        {header === "Status" ? (
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${reportStatusTone(row[header])}`}>
                            {row[header] ?? "-"}
                          </span>
                        ) : (
                          <span className="break-words">{row[header] ?? "-"}</span>
                        )}
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
              <SafeChartContainer height={288}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#9B1400" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SafeChartContainer>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 text-lg font-semibold text-white">Hazard Severity Trend</h3>
              <SafeChartContainer height={288}>
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
              </SafeChartContainer>
            </GlassCard>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
};

export default ReportsPage;
