import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import companyLogoUrl from "../assets/topbarlogo.png";
import { getMediaUrl } from "./media";
import { formatChainageRange, getChainageFrom } from "./chainage";

const normalizeChainageForCompare = (value = "") => String(value || "").trim().replace(/\s+/g, "").toLowerCase();

const getStrictChainageTo = (work = {}) => {
  const to = String(work.chainageTo || work["Chainage To"] || "").trim();
  const from = getChainageFrom(work);
  return to && normalizeChainageForCompare(to) !== normalizeChainageForCompare(from) ? to : "";
};

const COMPANY_NAME = "Udupi Tollway Pvt Ltd";
const SYSTEM_NAME = "Safety HSE Enterprise System";

const safe = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return value.name || value.email || "-";
  return String(value);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safe(value) : date.toLocaleString("en-IN");
};

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source.map(getMediaUrl).filter(Boolean);
};

const formatCorrectiveActions = (actions = []) => {
  if (!actions.length) return "No corrective action recorded.";
  return actions
    .map((item, index) => {
      const owner = safe(item.owner);
      const target = item.targetDate ? formatDate(item.targetDate) : "-";
      return `${index + 1}. ${safe(item.action)} | Owner: ${owner} | Target: ${target} | Status: ${safe(item.status || "Open")}`;
    })
    .join("\n");
};

const toDataUrl = async (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`Unable to load image (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const loadLogo = async () => {
  try {
    return await toDataUrl(companyLogoUrl);
  } catch (_error) {
    return "";
  }
};

const addPageHeader = (doc, reportTitle, logoData) => {
  const width = doc.internal.pageSize.getWidth();
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(14, 34, width - 14, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(COMPANY_NAME, 14, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(SYSTEM_NAME, 14, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(8, 145, 178);
  doc.text(reportTitle, 14, 29);
  if (logoData) {
    try {
      doc.addImage(logoData, undefined, width - 33, 8, 19, 19);
    } catch (_error) {
      // Keep PDF generation working if this browser cannot decode the logo.
    }
  }
};

const addPageFooters = (doc, generatedAt, generatedBy) => {
  const total = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, height - 15, width - 14, height - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generatedAt} | By: ${generatedBy}`, 14, height - 9);
    doc.text(`Page ${page} of ${total}`, width - 14, height - 9, { align: "right" });
  }
};

const addDetailsTable = (doc, rows, startY = 42) => {
  autoTable(doc, {
    startY,
    margin: { top: 42, left: 14, right: 14, bottom: 22 },
    head: [["Field", "Details"]],
    body: rows.map(([label, value]) => [label, safe(value)]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [15, 23, 42], textColor: [248, 250, 252], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [51, 65, 85], fillColor: [241, 245, 249] },
      1: { textColor: [15, 23, 42] }
    }
  });
  return doc.lastAutoTable.finalY;
};

const addDescription = (doc, title, description, startY) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(safe(description), width - 34);
  const needed = 14 + lines.length * 5;
  let y = startY + 9;
  if (y + needed > height - 24) {
    doc.addPage();
    y = 42;
  }
  doc.setFillColor(236, 254, 255);
  doc.roundedRect(14, y, width - 28, needed, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(14, 116, 144);
  doc.text(title, 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(lines, 18, y + 13);
  return y + needed;
};

const addTimeline = (doc, timeline = [], startY) => {
  if (!timeline.length) return startY;
  const rows = timeline.slice(-12).map((item) => [
    formatDate(item.at || item.createdAt || item.date),
    item.label || item.action || item.status || "Update",
    item.description || item.comment || "-"
  ]);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY + 9;
  if (y + 45 > pageHeight - 24) {
    doc.addPage();
    y = 42;
  }
  autoTable(doc, {
    startY: y,
    margin: { top: 42, left: 14, right: 14, bottom: 22 },
    head: [["Timeline Date", "Event", "Details"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 42 } }
  });
  return doc.lastAutoTable.finalY;
};

const addImagePage = async (doc, { label, url }) => {
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(label, 14, 43);

  try {
    const dataUrl = await toDataUrl(url);
    const properties = doc.getImageProperties(dataUrl);
    const maxWidth = 182;
    const maxHeight = 215;
    const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const drawWidth = properties.width * ratio;
    const drawHeight = properties.height * ratio;
    const x = (doc.internal.pageSize.getWidth() - drawWidth) / 2;
    const y = 50 + (maxHeight - drawHeight) / 2;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 48, 182, 219, 3, 3, "F");
    doc.addImage(dataUrl, undefined, x, y, drawWidth, drawHeight);
  } catch (_error) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(190, 24, 93);
    doc.text("Image could not be embedded. Open the source link below:", 14, 58);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink("Open source image", 14, 68, { url });
  }
};

const finalizePdf = async ({ reportTitle, fileName, detailRows, descriptionTitle, description, timeline, images }) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoData = await loadLogo();
  const generatedAt = new Date().toLocaleString("en-IN");
  const generatedBy = localStorage.getItem("name") || localStorage.getItem("userName") || "Safety HSE User";

  let y = addDetailsTable(doc, detailRows);
  y = addDescription(doc, descriptionTitle, description, y);
  addTimeline(doc, timeline, y);

  for (const image of images) {
    await addImagePage(doc, image);
  }

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    addPageHeader(doc, reportTitle, logoData);
  }
  addPageFooters(doc, generatedAt, generatedBy);
  doc.save(fileName);
  return true;
};

export const exportHazardDetailsPdf = async (hazard = {}) => {
  const evidence = normalizeMedia(hazard.evidenceImages, hazard.beforeImage);
  const closure = normalizeMedia(hazard.closureImages, hazard.afterImage);
  return finalizePdf({
    reportTitle: "Hazard Details Report",
    fileName: `hazard-details-${hazard._id || Date.now()}.pdf`,
    detailRows: [
      ["Report Date", formatDate(hazard.date || hazard.createdAt)],
      ["Category", hazard.category],
      ["Risk Level", `${safe(hazard.severity)} / ${safe(hazard.likelihood)} (Score ${hazard.riskScore || 0})`],
      ["Location", hazard.location],
      ["Plaza", hazard.plaza],
      ["Reported By", hazard.reportedBy || hazard.createdBy],
      ["Action Team", hazard.action || hazard.actionTeam],
      ["Action Taken", hazard.closureNotes || formatCorrectiveActions(hazard.correctiveActions || [])],
      ["Status", hazard.status || "Open"]
    ],
    descriptionTitle: "Hazard Description",
    description: hazard.description || hazard.details || hazard.observation || "No description entered.",
    timeline: hazard.timeline || hazard.approvalHistory || [],
    images: [
      ...evidence.map((url, index) => ({ label: `Evidence Image ${index + 1}`, url })),
      ...closure.map((url, index) => ({ label: `Closure Image ${index + 1}`, url }))
    ]
  });
};

export const exportWorkApprovalDetailsPdf = async (work = {}) => {
  const before = normalizeMedia(work.beforeImages, work.beforeImage);
  const after = normalizeMedia(work.afterImages, work.afterImage);
  const status = work.status || "Pending";
  const completionDate = status === "Completed"
    ? work.completedAt || work.completionDate || work.updatedAt
    : work.completionDate;
  return finalizePdf({
    reportTitle: "Work Approval Details Report",
    fileName: `work-approval-details-${work._id || work.id || Date.now()}.pdf`,
    detailRows: [
      ["Work Type", work.workType || work.title],
      ["Location", work.location || work.plaza],
      ["Chainage From", getChainageFrom(work)],
      ["Chainage To", getStrictChainageTo(work)],
      ["Chainage Range", formatChainageRange(work)],
      ["Workers Count", work.workersCount],
      ["Reported By", work.reportedBy || work.createdBy || work.submittedBy],
      ["Report Date", formatDate(work.reportDate || work.startDate || work.createdAt)],
      ["Status", status],
      ["Approved By", work.approvedBy || work.approvedByName],
      ["Completion Date", formatDate(completionDate)],
      ["Priority", work.priority]
    ],
    descriptionTitle: "Work Description",
    description: work.description || work.workDescription || work.details || "No description entered.",
    timeline: work.timeline || work.approvalHistory || [],
    images: [
      ...before.map((url, index) => ({ label: `Before Work Image ${index + 1}`, url })),
      ...after.map((url, index) => ({ label: `After Work Image ${index + 1}`, url }))
    ]
  });
};
