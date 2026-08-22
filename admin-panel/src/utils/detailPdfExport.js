import { loadPdfKit } from "./lazyVendor";
import companyLogoUrl from "../assets/vertis-logo.svg";
import { APP_NAME } from "../config/appConfig";
import { getMediaUrl } from "./media";
import { addStandardPdfFooters, PDF_COLORS, PDF_LAYOUT } from "./pdfDesign";
import {
  formatLocationAccuracy,
  formatLocationCapturedAt,
  formatLocationCoordinates,
  formatLocationSource,
  normalizeEvidenceLocation
} from "./location";
import {
  calculateCompletionPercentage,
  getApprovedChainageFrom,
  getApprovedChainageTo,
  getChainageFrom,
  getChainageTo,
  isPostApprovalStage,
  normalizeWorkStage
} from "./chainage";

// Resolved lazily by finalizePdf() so the ~350kB jsPDF bundle stays out of the
// main chunk; the synchronous table helpers below read them from module scope.
let jsPDF;
let autoTable;

const COMPANY_NAME = "Udupi Tollway Pvt Ltd";
const SYSTEM_NAME = APP_NAME;

const safe = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return value.name || value.email || "-";
  return String(value);
};

const formatRange = (from, to) => {
  if (!from && !to) return "";
  if (from && to && from !== to) return `${from} to ${to}`;
  return from || to;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safe(value) : date.toLocaleString("en-IN");
};

const normalizeMedia = (items = [], fallback) => {
  const source = items?.length ? items : fallback ? [fallback] : [];
  return source.map((item) => ({
    ...((item && typeof item === "object") ? item : {}),
    url: getMediaUrl(item?.url || item)
  })).filter((item) => Boolean(item.url));
};

const mediaLocation = (item = {}) => normalizeEvidenceLocation(item.location, item);

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

const toDataUrl = async (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return rasterizeImageDataUrl(url);
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`Unable to load image (${response.status})`);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return rasterizeImageDataUrl(dataUrl);
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
  doc.setDrawColor(...PDF_COLORS.border);
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
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(reportTitle, 14, 29);
  if (logoData) {
    try {
      const properties = doc.getImageProperties(logoData);
      const ratio = Math.min(30 / properties.width, 16 / properties.height);
      const logoWidth = properties.width * ratio;
      const logoHeight = properties.height * ratio;
      doc.addImage(logoData, undefined, width - 14 - logoWidth, 9, logoWidth, logoHeight);
    } catch (_error) {
      // Keep PDF generation working if this browser cannot decode the logo.
    }
  }
};

const addDetailsTable = (doc, rows, startY = 42, didDrawPage) => {
  autoTable(doc, {
    startY,
    margin: PDF_LAYOUT.margin,
    head: [["Field", "Details"]],
    body: rows.map(([label, value]) => [label, safe(value)]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: PDF_COLORS.charcoal, textColor: PDF_COLORS.white, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [51, 65, 85], fillColor: [241, 245, 249] },
      1: { textColor: [15, 23, 42] }
    },
    didDrawPage
  });
  return doc.lastAutoTable.finalY;
};

const addDescription = (doc, title, description, startY, onNewPage) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(safe(description), width - 34);
  const needed = 14 + lines.length * 5;
  let y = startY + 9;
  if (y + needed > height - 24) {
    doc.addPage();
    onNewPage?.();
    y = 42;
  }
  doc.setFillColor(...PDF_COLORS.primarySoft);
  doc.roundedRect(14, y, width - 28, needed, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(title, 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(lines, 18, y + 13);
  return y + needed;
};

const addTimeline = (doc, timeline = [], startY, didDrawPage) => {
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
    didDrawPage?.();
    y = 42;
  }
  autoTable(doc, {
    startY: y,
    margin: PDF_LAYOUT.margin,
    head: [["Timeline Date", "Event", "Details"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: PDF_COLORS.primary, textColor: PDF_COLORS.white },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 42 } },
    didDrawPage
  });
  return doc.lastAutoTable.finalY;
};

const addImagePage = async (doc, { label, item, mediaType = "image" }) => {
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(label, 14, 43);

  const location = mediaLocation(item);
  const address = location?.formattedAddress || "Location not recorded";
  const coordinates = formatLocationCoordinates(location);
  const mediaUrl = mediaType === "video" ? getMediaUrl(item.thumbnailUrl || item.url) : item.url;
  const maxWidth = 182;
  const maxHeight = 150;
  const frameY = 48;

  try {
    const dataUrl = await toDataUrl(mediaUrl);
    const properties = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const drawWidth = properties.width * ratio;
    const drawHeight = properties.height * ratio;
    const x = (doc.internal.pageSize.getWidth() - drawWidth) / 2;
    const y = frameY + 2 + (maxHeight - drawHeight) / 2;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, frameY, maxWidth, maxHeight + 4, 3, 3, "F");
    doc.addImage(dataUrl, undefined, x, y, drawWidth, drawHeight);
  } catch (_error) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(190, 24, 93);
    doc.text(`${mediaType === "video" ? "Video thumbnail" : "Image"} could not be embedded.`, 14, 58);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(`Open secure ${mediaType}`, 14, 68, { url: item.url });
  }

  const captionY = frameY + maxHeight + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Evidence location", 14, captionY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const addressLines = doc.splitTextToSize(address, maxWidth);
  doc.text(addressLines, 14, captionY + 6);
  const coordinateY = captionY + 6 + addressLines.length * 4.2;
  doc.text(`Coordinates: ${coordinates}`, 14, coordinateY);
  doc.text(`Accuracy: ${formatLocationAccuracy(location)}`, 14, coordinateY + 5);
  doc.text(`Captured: ${formatLocationCapturedAt(location)}`, 14, coordinateY + 10);
  doc.text(`Capture Source: ${formatLocationSource(location)}`, 14, coordinateY + 15);
};

const finalizePdf = async ({ reportTitle, fileName, detailRows, descriptionTitle, description, timeline, images, save = true }) => {
  // jsPDF/autotable are code-split — see utils/lazyVendor.js. The resolved
  // handles are stored module-side so the synchronous table helpers below
  // (addDetailsTable / addTimeline) keep their existing signatures.
  ({ jsPDF, autoTable } = await loadPdfKit());
  const doc = new jsPDF({ orientation: "portrait", unit: PDF_LAYOUT.unit, format: PDF_LAYOUT.format });
  const logoData = await loadLogo();
  const generatedAt = new Date().toLocaleString("en-IN");
  const generatedBy = localStorage.getItem("name") || localStorage.getItem("userName") || "Safety user";
  const drawHeader = () => addPageHeader(doc, reportTitle, logoData);

  const officialRows = detailRows.filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "-");
  let y = addDetailsTable(doc, officialRows, 42, drawHeader);
  y = addDescription(doc, descriptionTitle, description, y, drawHeader);
  addTimeline(doc, timeline, y, drawHeader);

  for (const image of images) {
    await addImagePage(doc, image);
  }

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    addPageHeader(doc, reportTitle, logoData);
  }
  addStandardPdfFooters(doc, { generatedAt, generatedBy });
  if (save) doc.save(fileName);
  return doc;
};

export const exportHazardDetailsPdf = async (hazard = {}, { save = true } = {}) => {
  const evidence = normalizeMedia(hazard.evidenceImages, hazard.beforeImage);
  const closure = normalizeMedia(hazard.closureImages, hazard.afterImage);
  const evidenceVideos = normalizeMedia(hazard.evidenceVideos, hazard.beforeVideo);
  const closureVideos = normalizeMedia(hazard.closureVideos, hazard.afterVideo);
  const primaryLocation = normalizeEvidenceLocation(hazard.geoLocation) || [...evidence, ...evidenceVideos, ...closure, ...closureVideos]
    .map(mediaLocation).find(Boolean);
  return finalizePdf({
    reportTitle: "Hazard Details Report",
    fileName: `hazard-details-${hazard._id || Date.now()}.pdf`,
    save,
    detailRows: [
      ["Report Date", formatDate(hazard.date || hazard.createdAt)],
      ["Category", hazard.category],
      ["Risk Level", `${safe(hazard.severity)} / ${safe(hazard.likelihood)} (Score ${hazard.riskScore || 0})`],
      ["Location", hazard.location],
      ["GPS Address", primaryLocation?.formattedAddress],
      ["GPS Coordinates", primaryLocation ? formatLocationCoordinates(primaryLocation) : ""],
      ["GPS Source", primaryLocation ? formatLocationSource(primaryLocation) : ""],
      ["GPS Accuracy", primaryLocation ? formatLocationAccuracy(primaryLocation) : ""],
      ["GPS Captured", primaryLocation ? formatLocationCapturedAt(primaryLocation) : ""],
      ["Plaza", hazard.plaza],
      ["Reported By", hazard.reportedBy || hazard.createdBy],
      ["Action Team", hazard.action || hazard.actionTeam],
      ["Action Taken", hazard.closureNotes || formatCorrectiveActions(hazard.correctiveActions || [])],
      ["Status", hazard.status || "Open"],
      ["Evidence Images", evidence.length],
      ["Evidence Videos", evidenceVideos.length],
      ["Closure Images", closure.length],
      ["Closure Videos", closureVideos.length]
    ],
    descriptionTitle: "Hazard Description",
    description: hazard.description || hazard.details || hazard.observation || "No description entered.",
    timeline: hazard.timeline || hazard.approvalHistory || [],
    images: [
      ...evidence.map((item, index) => ({ label: `Evidence Image ${index + 1}`, item, mediaType: "image" })),
      ...evidenceVideos.map((item, index) => ({ label: `Evidence Video ${index + 1}`, item, mediaType: "video" })),
      ...closure.map((item, index) => ({ label: `Closure Image ${index + 1}`, item, mediaType: "image" })),
      ...closureVideos.map((item, index) => ({ label: `Closure Video ${index + 1}`, item, mediaType: "video" }))
    ]
  });
};

export const exportWorkApprovalDetailsPdf = async (work = {}, { save = true } = {}) => {
  const before = normalizeMedia(work.beforeImages, work.beforeImage);
  const after = normalizeMedia(work.afterImages, work.afterImage);
  const beforeVideos = normalizeMedia(work.beforeVideos, work.beforeVideo);
  const afterVideos = normalizeMedia(work.afterVideos, work.afterVideo);
  const status = normalizeWorkStage(work);
  const postApproval = isPostApprovalStage(work);
  const completed = ["Completed", "Partially Completed"].includes(status);
  const completionDate = ["Completed", "Partially Completed"].includes(status)
    ? work.completedAt || work.completionDate || work.updatedAt
    : work.completionDate;
  const allMedia = [...before, ...beforeVideos, ...after, ...afterVideos];
  const primaryLocation = normalizeEvidenceLocation(work.geoLocation) || allMedia.map(mediaLocation).find(Boolean);
  return finalizePdf({
    reportTitle: "Work Approval Report",
    fileName: `work-approval-details-${work._id || work.id || Date.now()}.pdf`,
    save,
    detailRows: [
      ["Approval Number", work.approvalNumber],
      ["Work Type", work.workType || work.title],
      ["Location", work.location || work.plaza],
      ["Requested Chainage", formatRange(getChainageFrom(work), getChainageTo(work))],
      ["Approved Chainage", postApproval ? formatRange(getApprovedChainageFrom(work), getApprovedChainageTo(work)) : ""],
      ["Completed Chainage", completed ? formatRange(work.completedChainageFrom, work.completedChainageTo) : ""],
      ["Completion", completed ? `${calculateCompletionPercentage(work)}%` : ""],
      ["Remaining Chainage", status === "Partially Completed" ? formatRange(work.remainingChainageFrom, work.remainingChainageTo) : ""],
      ["Partial Completion Reason", status === "Partially Completed" ? work.partialCompletionReason : ""],
      ["Workers Count", work.workersCount],
      ["Created By", work.createdByName || work.reportedBy || work.createdBy || work.submittedBy],
      ["Created Role", work.createdByRole],
      ["Workflow Stage", status],
      ["Checked By", work.checkedBy],
      ["Checked Role", work.checkedByRole],
      ["Checked Date", formatDate(work.checkedAt)],
      ["Review Findings", work.checkedDescription],
      ["Recommended By", work.recommendedBy],
      ["Recommended Role", work.recommendedByRole],
      ["Recommended Date", formatDate(work.recommendedAt)],
      ["Recommendation Remarks", work.recommendedDescription],
      ["Created Date", formatDate(work.reportDate || work.startDate || work.createdAt)],
      ["Approved By", work.approvedByName || work.approvedBy],
      ["Approved Role", work.approvedByRole],
      ["Approval Date", formatDate(work.approvedAt || work.approvalDate)],
      ["Approval Remarks", work.approvalDescription],
      ["Returned By", work.returnedBy],
      ["Returned Date", formatDate(work.returnedAt)],
      ["Correction Reason", work.returnDescription],
      ["Completed By", work.completedBy],
      ["Completion Date", formatDate(completionDate)],
      ["Completion Description", work.completionDescription],
      ["GPS Address", primaryLocation?.formattedAddress],
      ["GPS Coordinates", primaryLocation ? formatLocationCoordinates(primaryLocation) : ""],
      ["GPS Source", primaryLocation ? formatLocationSource(primaryLocation) : ""],
      ["GPS Accuracy", primaryLocation ? formatLocationAccuracy(primaryLocation) : ""],
      ["GPS Captured", primaryLocation ? formatLocationCapturedAt(primaryLocation) : ""],
      ["Before Images", before.length],
      ["Before Videos", beforeVideos.length],
      ["After Images", after.length],
      ["After Videos", afterVideos.length]
    ],
    descriptionTitle: "Work Description",
    description: work.description || work.workDescription || work.details || "No description entered.",
    timeline: work.timeline || work.approvalHistory || [],
    images: [
      ...before.map((item, index) => ({ label: `Before Work Image ${index + 1}`, item, mediaType: "image" })),
      ...beforeVideos.map((item, index) => ({ label: `Before Work Video ${index + 1}`, item, mediaType: "video" })),
      ...after.map((item, index) => ({ label: `Completion Image ${index + 1}`, item, mediaType: "image" })),
      ...afterVideos.map((item, index) => ({ label: `Completion Video ${index + 1}`, item, mediaType: "video" }))
    ]
  });
};
