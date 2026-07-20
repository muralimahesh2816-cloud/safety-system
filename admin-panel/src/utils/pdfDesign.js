import { APP_NAME } from "../config/appConfig";

export const PDF_LAYOUT = Object.freeze({
  format: "a4",
  unit: "mm",
  margin: Object.freeze({ top: 46, right: 14, bottom: 22, left: 14 })
});

export const PDF_COLORS = Object.freeze({
  primary: [155, 20, 0],
  primarySoft: [248, 233, 230],
  charcoal: [30, 32, 34],
  text: [30, 32, 34],
  muted: [103, 99, 95],
  border: [222, 216, 210],
  surfaceMuted: [248, 246, 243],
  white: [255, 255, 255]
});

export const addStandardPdfFooters = (doc, { generatedAt, generatedBy = "System" } = {}) => {
  const total = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(PDF_LAYOUT.margin.left, height - 16, width - PDF_LAYOUT.margin.right, height - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(APP_NAME, PDF_LAYOUT.margin.left, height - 11);
    doc.text(`Generated: ${generatedAt}${generatedBy ? ` | By: ${generatedBy}` : ""}`, PDF_LAYOUT.margin.left, height - 7);
    doc.text("Authorized system-generated report", width / 2, height - 11, { align: "center" });
    doc.text(`Page ${page} of ${total}`, width - PDF_LAYOUT.margin.right, height - 7, { align: "right" });
  }
};
