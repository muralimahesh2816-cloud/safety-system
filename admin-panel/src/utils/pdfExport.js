import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getChainageFrom, getChainageTo } from "./chainage";

const reportColumns = {
  work: [
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Plaza", keys: ["Plaza", "plaza"] },
    { header: "Work Type", keys: ["Work Type", "workType", "title"] },
    { header: "Description", keys: ["Description", "description", "workDescription"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Chainage From", keys: ["Chainage From", "chainageFrom", "chainage", "chainageNo"], type: "chainageFrom" },
    { header: "Chainage To", keys: ["Chainage To", "chainageTo", "chainageFrom", "chainage", "chainageNo"], type: "chainageTo" },
    { header: "Workers", keys: ["Workers", "Workers Count", "workersCount"] },
    { header: "Status", keys: ["Status", "status"] },
    { header: "Reported By", keys: ["Reported By", "reportedBy", "createdBy"] },
    { header: "Approved By", keys: ["Approved By", "approvedBy"] },
    { header: "Completion Date", keys: ["Completion Date", "completionDate", "completedAt"], type: "date" }
  ],
  hazard: [
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Plaza", keys: ["Plaza", "plaza"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Reported By", keys: ["Reported By", "reportedBy"] },
    { header: "Category", keys: ["Category", "category"] },
    { header: "Description", keys: ["Description", "description"] },
    { header: "Risk Level", keys: ["Risk Level", "riskLevel", "severity"] },
    { header: "Risk Score", keys: ["Risk Score", "riskScore"] },
    { header: "Action Team", keys: ["Action Team", "Action", "action", "actionTeam"] },
    { header: "Action Taken", keys: ["Action Taken", "actionTaken", "correctiveAction"] },
    { header: "Status", keys: ["Status", "status"] }
  ],
  training: [
    { header: "Training Title", keys: ["Training Title", "Title", "title"] },
    { header: "Trainer", keys: ["Trainer", "trainer", "uploadedBy", "createdBy"] },
    { header: "Category", keys: ["Category", "category"] },
    { header: "Duration", keys: ["Duration", "duration", "durationMinutes"] },
    { header: "Completions", keys: ["Completions", "completionCount"] },
    { header: "Uploaded Date", keys: ["Uploaded Date", "Date", "createdAt", "uploadedAt"], type: "date" },
    { header: "Status", keys: ["Status", "status"] }
  ],
  date: [
    { header: "Date", keys: ["Date", "date"], type: "date" },
    { header: "Total Hazards", keys: ["Total Hazards", "Total", "total"] },
    { header: "Open", keys: ["Open", "open"] },
    { header: "Closed", keys: ["Closed", "closed"] },
    { header: "Closure Rate", keys: ["Closure Rate", "closureRate"] }
  ],
  user: [
    { header: "User Name", keys: ["User Name", "user", "name"] },
    { header: "Hazards Reported", keys: ["Hazards Reported", "Hazards Uploaded", "hazardsUploaded"] },
    { header: "Open", keys: ["Open", "open"] },
    { header: "Closed", keys: ["Closed", "closed"] },
    { header: "Closure Rate", keys: ["Closure Rate", "closureRate"] }
  ],
  approved: [
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Work Type", keys: ["Work Type", "workType", "title"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Chainage From", keys: ["Chainage From", "chainageFrom", "chainage", "chainageNo"], type: "chainageFrom" },
    { header: "Chainage To", keys: ["Chainage To", "chainageTo", "chainageFrom", "chainage", "chainageNo"], type: "chainageTo" },
    { header: "Workers", keys: ["Workers", "Workers Count", "workersCount"] },
    { header: "Approved By", keys: ["Approved By", "approvedBy"] },
    { header: "Status", keys: ["Status", "status"] }
  ]
};

const safeValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) return value.map(safeValue).filter((item) => item !== "-").join(", ") || "-";
  if (typeof value === "object") return value.name || value.email || value.action || "-";
  return String(value);
};

const pickValue = (row, keys = []) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "-";
};

const formatDateValue = (value) => {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeValue(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatColumnValue = (row, column) => {
  if (column.type === "chainageFrom") return safeValue(getChainageFrom(row));
  if (column.type === "chainageTo") return safeValue(getChainageTo(row));
  const value = pickValue(row, column.keys);
  return column.type === "date" ? formatDateValue(value) : safeValue(value);
};

export const getReportColumns = (type = "work") => reportColumns[type] || reportColumns.work;

export const normalizeReportRowsByType = (rows = [], type = "work") => {
  const columns = getReportColumns(type);
  return rows.map((row) =>
    columns.reduce((acc, column) => {
      acc[column.header] = formatColumnValue(row, column);
      return acc;
    }, {})
  );
};

const formatGeneratedDate = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

const loadImageAsDataUrl = async (source) => {
  if (!source || String(source).startsWith("data:")) return source || "";
  try {
    const response = await fetch(source);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (_error) {
    return "";
  }
};

const addHeader = (doc, { companyName, reportTitle, generatedBy, generatedDateText, logoData }) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 44, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName, 14, 13);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Safety HSE Enterprise System", 14, 19);
  doc.setFontSize(12);
  doc.setTextColor(180, 35, 24);
  doc.text(reportTitle, 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated By: ${generatedBy}`, 14, 34);
  doc.text(`Generated: ${generatedDateText}`, 14, 39);

  if (logoData) {
    try {
      const properties = doc.getImageProperties(logoData);
      const maxWidth = 25;
      const maxHeight = 25;
      const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
      const logoWidth = properties.width * ratio;
      const logoHeight = properties.height * ratio;
      const x = pageWidth - 14 - logoWidth;
      const y = 7 + (maxHeight - logoHeight) / 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 43, 5, 29, 29, 3, 3, "F");
      doc.addImage(logoData, undefined, x, y, logoWidth, logoHeight);
    } catch (_error) {
      // The report remains usable if a browser cannot decode the image.
    }
  }

  doc.setDrawColor(180, 35, 24);
  doc.setLineWidth(0.8);
  doc.line(14, 43, pageWidth - 14, 43);
};

export const exportReportPdf = async ({
  rows = [],
  type = "work",
  reportTitle = "Report",
  companyName = "Udupi Tollway Pvt Ltd",
  companyLogo,
  generatedBy = "System",
  generatedAt = new Date()
}) => {
  const normalizedRows = normalizeReportRowsByType(rows, type);
  if (!normalizedRows.length) return false;

  const headers = getReportColumns(type).map((column) => column.header);
  const body = normalizedRows.map((row) => headers.map((header) => row[header] ?? "-"));
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedDateText = formatGeneratedDate(generatedAt);
  const logoData = await loadImageAsDataUrl(companyLogo);

  autoTable(doc, {
    startY: 49,
    margin: { top: 49, bottom: 18, left: 10, right: 10 },
    head: [headers],
    body,
    theme: "grid",
    styles: {
      fontSize: headers.length > 9 ? 6.8 : 8,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
      halign: "left"
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addHeader(doc, { companyName, reportTitle, generatedBy, generatedDateText, logoData });
    doc.setDrawColor(226, 232, 240);
    doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generatedDateText}`, 10, pageHeight - 8);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - 10, pageHeight - 8, { align: "right" });
  }

  doc.save(`${type}_report.pdf`);
  return true;
};
