import { loadFileSaver, loadPdfKit, loadXlsx } from "./lazyVendor";
import { ORGANIZATION_NAME } from "../config/appConfig";

const safe = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return value.name || value.label || JSON.stringify(value);
  return String(value);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safe(value) : date.toLocaleDateString("en-IN");
};

const reportRows = (records = []) => records.map((record) => ({
  "Record ID": safe(record.recordId),
  Title: safe(record.title),
  Category: safe(record.category),
  Site: safe(record.site),
  Status: safe(record.status),
  Severity: safe(record.severity),
  Priority: safe(record.priority),
  "Business Date": formatDate(record.businessDate),
  "Due Date": formatDate(record.dueDate),
  "Expiry Date": formatDate(record.expiryDate),
  "Assigned To": safe(record.assignedTo),
  "Created By": safe(record.createdBy || record.createdByName),
  "Created At": formatDate(record.createdAt)
}));

const fileStem = (module, suffix) => `${module.key}-${suffix}-${new Date().toISOString().slice(0, 10)}`;

// Excel/PDF vendors are code-split (see utils/lazyVendor.js), which makes
// these exporters async. Callers already treat them as fire-and-forget click
// handlers, so nothing downstream had to change.
export const exportHseExcel = async ({ module, records, filters = {} }) => {
  const [XLSX, saveAs] = await Promise.all([loadXlsx(), loadFileSaver()]);
  const workbook = XLSX.utils.book_new();
  const rows = reportRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: "No matching records" }]);
  worksheet["!cols"] = Object.keys(rows[0] || { Message: "" }).map((key) => ({ wch: Math.min(42, Math.max(14, key.length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "HSE Records");
  const metadata = XLSX.utils.json_to_sheet([
    { Field: "Organization", Value: ORGANIZATION_NAME },
    { Field: "Module", Value: module.label },
    { Field: "Generated", Value: new Date().toLocaleString("en-IN") },
    { Field: "Filters", Value: Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(", ") || "None" },
    { Field: "Record Count", Value: records.length }
  ]);
  XLSX.utils.book_append_sheet(workbook, metadata, "Report Information");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileStem(module, "register")}.xlsx`);
};

export const exportHsePdf = async ({ module, records, filters = {} }) => {
  const { jsPDF, autoTable } = await loadPdfKit();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({
    title: `${module.label} Register`,
    subject: "Enterprise HSE controlled report",
    author: ORGANIZATION_NAME,
    creator: "Safety Management System"
  });
  doc.setFillColor(8, 47, 73);
  doc.rect(0, 0, 297, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(ORGANIZATION_NAME, 14, 11);
  doc.setFontSize(11);
  doc.text(`${module.label} - Controlled Register`, 14, 20);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")} | Records: ${records.length}`, 14, 34);
  const filterText = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" | ");
  doc.text(`Filters: ${filterText || "None"}`, 14, 39, { maxWidth: 270 });

  const rows = reportRows(records);
  const columns = ["Record ID", "Title", "Category", "Site", "Status", "Severity", "Priority", "Due Date", "Expiry Date", "Assigned To"];
  autoTable(doc, {
    startY: 44,
    head: [columns],
    body: rows.map((row) => columns.map((column) => row[column])),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 43 }, 3: { cellWidth: 32 }, 4: { cellWidth: 25 } },
    didDrawPage: ({ pageNumber }) => {
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text("System-generated controlled report. Verify current status in the Safety Management System.", 14, 202);
      doc.text(`Page ${pageNumber}`, 282, 202, { align: "right" });
    }
  });
  doc.save(`${fileStem(module, "register")}.pdf`);
};

export const exportHseDetailPdf = async ({ module, record }) => {
  const { jsPDF, autoTable } = await loadPdfKit();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: `${record.recordId} ${record.title}`, author: ORGANIZATION_NAME });
  doc.setFillColor(8, 47, 73);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(module.label, 14, 12);
  doc.setFontSize(10);
  doc.text(`${safe(record.recordId)} | ${safe(record.status)}`, 14, 21);
  const details = [
    ["Title", safe(record.title)], ["Description", safe(record.description)],
    ["Category", safe(record.category)], ["Site", safe(record.site)],
    ["Location", safe(record.location)], ["Severity", safe(record.severity)],
    ["Priority", safe(record.priority)], ["Assigned To", safe(record.assignedTo)],
    ["Business Date", formatDate(record.businessDate)], ["Due Date", formatDate(record.dueDate)],
    ["Expiry Date", formatDate(record.expiryDate)], ["Created By", safe(record.createdBy || record.createdByName)]
  ];
  Object.entries(record.data || {}).forEach(([key, value]) => details.push([key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), safe(value)]));
  autoTable(doc, { startY: 38, body: details, theme: "grid", styles: { fontSize: 9, cellPadding: 2.5 }, columnStyles: { 0: { cellWidth: 46, fontStyle: "bold", fillColor: [241, 245, 249] } } });
  if (record.history?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Date", "Action", "From", "To", "Note", "Actor"]],
      body: record.history.map((item) => [formatDate(item.at), safe(item.action), safe(item.fromStatus), safe(item.toStatus), safe(item.note), safe(item.actor || item.actorName)]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110] }
    });
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`Controlled copy | Page ${page} of ${pageCount}`, 196, 288, { align: "right" });
  }
  doc.save(`${fileStem(module, record.recordId || "record")}.pdf`);
};
