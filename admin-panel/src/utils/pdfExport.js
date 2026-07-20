import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { APP_NAME } from "../config/appConfig";
import { getChainageFrom } from "./chainage";
import { addStandardPdfFooters, PDF_COLORS, PDF_LAYOUT } from "./pdfDesign";

const reportColumns = {
  work: [
    { header: "Approval No", keys: ["Approval No", "approvalNumber"] },
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Work Type", keys: ["Work Type", "workType", "title"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Requested Chainage", keys: ["Requested Chainage", "requestedChainage"] },
    { header: "Approved Chainage", keys: ["Approved Chainage", "approvedChainage"] },
    { header: "Completed Chainage", keys: ["Completed Chainage", "completedChainage"] },
    { header: "Completion %", keys: ["Completion %", "completionPercentage"] },
    { header: "Workers", keys: ["Workers", "Workers Count", "workersCount"] },
    { header: "Created By", keys: ["Created By", "createdByName", "reportedBy", "createdBy"] },
    { header: "Created Role", keys: ["Created Role", "createdByRole"] },
    { header: "Workflow Stage", keys: ["Workflow Stage", "workflowStage", "status"] },
    { header: "Checked By", keys: ["Checked By", "checkedBy"] },
    { header: "Recommended By", keys: ["Recommended By", "recommendedBy"] },
    { header: "Approved By", keys: ["Approved By", "approvedByName", "approvedBy"] },
    { header: "Status", keys: ["Status", "status"] }
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
    { header: "Action Taken", keys: ["Action Taken", "closureNotes", "actionTaken", "correctiveAction"] },
    { header: "Status", keys: ["Status", "status"] },
    { header: "Evidence Image", keys: ["Evidence Image", "beforeImage", "evidenceImages"] },
    { header: "Closure Image", keys: ["Closure Image", "afterImage", "closureImages"] },
    { header: "Evidence Video", keys: ["Evidence Video", "beforeVideo", "evidenceVideos"] },
    { header: "Closure Video", keys: ["Closure Video", "afterVideo", "closureVideos"] },
    { header: "Media Count", keys: ["Media Count", "mediaCount"] }
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
    { header: "Approval No", keys: ["Approval No", "approvalNumber"] },
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Work Type", keys: ["Work Type", "workType", "title"] },
    { header: "Description", keys: ["Description", "description", "workDescription"] },
    { header: "Plaza", keys: ["Plaza", "plaza"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Chainage From", keys: ["Chainage From", "chainageFrom", "chainage", "chainageNo"], type: "chainageFrom" },
    { header: "Chainage To", keys: ["Chainage To", "chainageTo"], type: "chainageTo" },
    { header: "Requested Chainage", keys: ["Requested Chainage", "requestedChainage"] },
    { header: "Approved Chainage", keys: ["Approved Chainage", "approvedChainage"] },
    { header: "Completed Chainage", keys: ["Completed Chainage", "completedChainage"] },
    { header: "Remaining Chainage", keys: ["Remaining Chainage", "remainingChainage"] },
    { header: "Partial Reason", keys: ["Partial Completion Reason", "partialCompletionReason"] },
    { header: "Completion %", keys: ["Completion %", "completionPercentage"] },
    { header: "Workers", keys: ["Workers", "Workers Count", "workersCount"] },
    { header: "Created By", keys: ["Created By", "createdByName", "reportedBy", "createdBy"] },
    { header: "Workflow Stage", keys: ["Workflow Stage", "workflowStage", "status"] },
    { header: "Checked By", keys: ["Checked By", "checkedBy"] },
    { header: "Checked Role", keys: ["Checked Role", "checkedByRole"] },
    { header: "Checked Date", keys: ["Checked Date", "checkedAt"], type: "date" },
    { header: "Review Findings", keys: ["Review Findings", "Checked Description", "checkedDescription"] },
    { header: "Recommended By", keys: ["Recommended By", "recommendedBy"] },
    { header: "Recommended Role", keys: ["Recommended Role", "recommendedByRole"] },
    { header: "Recommended Date", keys: ["Recommended Date", "recommendedAt"], type: "date" },
    { header: "Recommendation Remarks", keys: ["Recommendation Remarks", "Recommended Description", "recommendedDescription"] },
    { header: "Approved By", keys: ["Approved By", "approvedByName", "approvedBy"] },
    { header: "Approved Role", keys: ["Approved Role", "approvedByRole"] },
    { header: "Approval Date", keys: ["Approval Date", "approvedAt", "approvalDate"], type: "date" },
    { header: "Approval Remarks", keys: ["Approval Remarks", "Approval Description", "approvalDescription"] },
    { header: "Returned By", keys: ["Returned By", "returnedBy"] },
    { header: "Returned Date", keys: ["Returned Date", "returnedAt"], type: "date" },
    { header: "Return Reason", keys: ["Return Description", "returnDescription"] },
    { header: "Completion Date", keys: ["Completion Date", "completionDate", "completedAt"], type: "date" },
    { header: "Completed By", keys: ["Completed By", "completedBy"] },
    { header: "Completion Description", keys: ["Completion Description", "completionDescription"] },
    { header: "Updated Date", keys: ["Updated Date", "updatedAt"], type: "date" },
    { header: "Audit History Summary", keys: ["Audit History Summary", "auditHistorySummary"] },
    { header: "Status", keys: ["Status", "status"] },
    { header: "Before Image", keys: ["Before Image", "beforeImage", "beforeImages"] },
    { header: "After Image", keys: ["After Image", "afterImage", "afterImages"] },
    { header: "Before Video", keys: ["Before Video", "beforeVideo", "beforeVideos"] },
    { header: "After Video", keys: ["After Video", "afterVideo", "afterVideos"] },
    { header: "Media Count", keys: ["Media Count", "mediaCount"] }
  ]
};

// Official PDFs intentionally exclude internal identifiers, raw media paths, and verbose audit fields.
const pdfReportColumns = {
  work: reportColumns.work,
  approved: null,
  hazard: [
    { header: "Date", keys: ["Date", "date", "createdAt"], type: "date" },
    { header: "Plaza", keys: ["Plaza", "plaza"] },
    { header: "Location / Chainage", keys: ["Location / Chainage", "Location", "location"] },
    { header: "Reported By", keys: ["Reported By", "reportedBy"] },
    { header: "Category", keys: ["Category", "category"] },
    { header: "Description", keys: ["Description", "description"] },
    { header: "Action Team", keys: ["Action Team", "actionTeam", "Action"] },
    { header: "Action Taken", keys: ["Action Taken", "closureNotes", "actionTaken"] },
    { header: "Status", keys: ["Status", "status"] }
  ],
  training: [
    { header: "Training Title", keys: ["Training Title", "Title", "title"] },
    { header: "Concept", keys: ["Concept", "concept", "description"] },
    { header: "Trainer", keys: ["Trainer", "trainer", "uploadedBy"] },
    { header: "Category", keys: ["Category", "category"] },
    { header: "Location", keys: ["Location", "location"] },
    { header: "Duration", keys: ["Duration", "duration", "durationMinutes"] },
    { header: "Completions", keys: ["Completions", "completionCount"] },
    { header: "Remarks", keys: ["Remarks", "remarks"] },
    { header: "Uploaded Date", keys: ["Uploaded Date", "Date", "createdAt"], type: "date" },
    { header: "Status", keys: ["Status", "status"] }
  ]
};
pdfReportColumns.approved = reportColumns.approved;

const safeValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) return value.map(safeValue).filter((item) => item !== "-").join(", ") || "-";
  if (typeof value === "object") {
    return value.url || value.secure_url || value.path || value.filename || value.name || value.email || value.action || "-";
  }
  return String(value);
};

const pickValue = (row, keys = []) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "-";
};

const hasMediaValue = (value) => {
  if (!value || value === "-") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Boolean(value.url || value.secure_url || value.path || value.filename);
  return Boolean(String(value).trim());
};

const normalizeChainageForCompare = (value = "") => String(value || "").trim().replace(/\s+/g, "").toLowerCase();

const getReportChainageTo = (row = {}) => {
  const to = String(row.chainageTo || row["Chainage To"] || "").trim();
  const from = getChainageFrom(row);
  return to && normalizeChainageForCompare(to) !== normalizeChainageForCompare(from) ? to : "";
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

const formatColumnValue = (row, column, index) => {
  if (column.type === "index") return String(index + 1);
  if (column.type === "chainageFrom") return safeValue(getChainageFrom(row));
  if (column.type === "chainageTo") return safeValue(getReportChainageTo(row));
  const value = pickValue(row, column.keys);
  if (column.type === "imageStatus") return hasMediaValue(value) ? "Available" : "Not Uploaded";
  return column.type === "date" ? formatDateValue(value) : safeValue(value);
};

export const getReportColumns = (type = "work") => reportColumns[type] || reportColumns.work;

export const getPdfReportColumns = (type = "work") =>
  pdfReportColumns[type] || reportColumns[type] || pdfReportColumns.work;

const normalizeRowsWithColumns = (rows = [], columns = []) =>
  rows.map((row, index) =>
    columns.reduce((acc, column) => {
      acc[column.header] = formatColumnValue(row, column, index);
      return acc;
    }, {})
  );

export const normalizeReportRowsByType = (rows = [], type = "work") => {
  return normalizeRowsWithColumns(rows, getReportColumns(type));
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
  if (!source) return "";
  if (String(source).startsWith("data:")) return rasterizeImageDataUrl(source);
  try {
    const response = await fetch(source);
    if (!response.ok) return "";
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return await rasterizeImageDataUrl(dataUrl);
  } catch (_error) {
    return "";
  }
};

const rasterizeImageDataUrl = (dataUrl) =>
  new Promise((resolve) => {
    if (!dataUrl) {
      resolve("");
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width || 512;
        canvas.height = image.naturalHeight || image.height || 512;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (_error) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const addHeader = (doc, { companyName, reportTitle, generatedBy, generatedDateText, logoData }) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_COLORS.surfaceMuted);
  doc.rect(0, 0, pageWidth, 44, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(companyName, 14, 13);
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(APP_NAME, 14, 19);
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(reportTitle, 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.muted);
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

  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(14, 43, pageWidth - 14, 43);
};

const reportColumnStyles = {
  work: {
    0: { cellWidth: 17 },
    1: { cellWidth: 16 },
    2: { cellWidth: 18 },
    3: { cellWidth: 21 },
    4: { cellWidth: 20 },
    5: { cellWidth: 20 },
    6: { cellWidth: 20 },
    7: { cellWidth: 12 },
    8: { cellWidth: 11 },
    9: { cellWidth: 18 },
    10: { cellWidth: 16 },
    11: { cellWidth: 18 },
    12: { cellWidth: 17 },
    13: { cellWidth: 17 },
    14: { cellWidth: 17 },
    15: { cellWidth: 15 }
  },
  approved: {
    0: { cellWidth: 24 },
    1: { cellWidth: 28 },
    2: { cellWidth: 34 },
    3: { cellWidth: 28 },
    4: { cellWidth: 28 },
    5: { cellWidth: 18 },
    6: { cellWidth: 34 },
    7: { cellWidth: 24 }
  }
};

export const exportReportPdf = async ({
  rows = [],
  type = "work",
  reportTitle = "Report",
  companyName = "Udupi Tollway Pvt Ltd",
  companyLogo,
  generatedBy = "System",
  generatedAt = new Date(),
  save = true
}) => {
  const pdfColumns = getPdfReportColumns(type);
  const normalizedRows = normalizeRowsWithColumns(rows, pdfColumns);
  if (!normalizedRows.length) return false;

  const headers = pdfColumns.map((column) => column.header);
  const body = normalizedRows.map((row) => headers.map((header) => row[header] ?? "-"));
  const compactTable = headers.length > 14;
  const orientation = headers.length > 7 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: PDF_LAYOUT.unit, format: PDF_LAYOUT.format });
  const generatedDateText = formatGeneratedDate(generatedAt);
  const logoData = await loadImageAsDataUrl(companyLogo);

  autoTable(doc, {
    startY: 49,
    margin: { top: 49, bottom: 22, left: orientation === "landscape" ? 10 : 14, right: orientation === "landscape" ? 10 : 14 },
    head: [headers],
    body,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    columnStyles: reportColumnStyles[type] || {},
    styles: {
      fontSize: compactTable ? 5.8 : headers.length > 9 ? 6.2 : 7.5,
      cellPadding: compactTable ? 1.25 : 1.8,
      minCellHeight: 8,
      overflow: "linebreak",
      valign: "middle",
      lineColor: PDF_COLORS.border,
      lineWidth: 0.12,
      textColor: PDF_COLORS.text
    },
    headStyles: {
      fillColor: ["work", "approved"].includes(type) ? [198, 0, 0] : PDF_COLORS.charcoal,
      textColor: PDF_COLORS.white,
      fontStyle: "bold",
      fontSize: compactTable ? 6 : headers.length > 9 ? 6.3 : 7.8,
      halign: "left"
    },
    alternateRowStyles: { fillColor: PDF_COLORS.surfaceMuted }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addHeader(doc, { companyName, reportTitle, generatedBy, generatedDateText, logoData });
  }

  addStandardPdfFooters(doc, { generatedAt: generatedDateText, generatedBy });

  if (save) doc.save(`${type}_report.pdf`);
  return save ? true : doc;
};
