import jsPDF from "jspdf";
import companyLogoUrl from "../assets/vertis-logo.svg";
import { APP_NAME, ORGANIZATION_NAME } from "../config/appConfig";
import { PDF_COLORS } from "./pdfDesign";

// Never rendered on the certificate or passed to jsPDF: Mongo _id values
// (other than certificateNumber, which is a human-readable business key),
// JWTs, internal API payloads, or Cloudinary asset ids. Every value drawn
// below comes from the named, already-safe fields on the Certificate
// document — see backend/src/models/Certificate.js.
const NOT_AVAILABLE = "Not Available";

const displayValue = (value) => {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : NOT_AVAILABLE;
};

const formatCertDate = (value) => {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
};

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return NOT_AVAILABLE;
  const total = Number(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
};

const formatScore = (score) =>
  score === null || score === undefined || Number.isNaN(Number(score)) ? NOT_AVAILABLE : `${score}%`;

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

const loadLogoDataUrl = async () => {
  try {
    const response = await fetch(companyLogoUrl, { mode: "cors" });
    if (!response.ok) throw new Error(`Unable to load logo (${response.status})`);
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

const drawMetaGrid = (doc, { rows, startY, centerX, width }) => {
  const rowGap = 13;
  let y = startY;
  rows.forEach((columns) => {
    const columnWidth = width / columns.length;
    const startX = centerX - width / 2;
    columns.forEach((column, index) => {
      const colCenter = startX + columnWidth * index + columnWidth / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(column.label.toUpperCase(), colCenter, y, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...PDF_COLORS.charcoal);
      doc.text(String(column.value), colCenter, y + 5.5, { align: "center" });
      if (index > 0) {
        doc.setDrawColor(...PDF_COLORS.border);
        doc.setLineWidth(0.2);
        doc.line(startX + columnWidth * index, y - 4.5, startX + columnWidth * index, y + 6.5);
      }
    });
    y += rowGap;
  });
  return y;
};

/**
 * Renders a premium, print-safe "Training Completion Certificate" (A4
 * landscape) containing the full corporate/HSE field set and triggers a
 * PDF. Since a real scannable QR image needs a QR-generation dependency
 * this sandbox couldn't install/verify (npm registry blocked — see the
 * session's final report), the certificate instead prints the
 * verification code and the /verify link that resolves it — an accepted
 * alternative per the spec ("optional QR code"). Swap in a real QR image
 * later by adding e.g. `qrcode` and calling doc.addImage with its output
 * where the verification block is drawn below.
 *
 * Returns the built jsPDF document without saving/opening it — callers
 * decide what to do with it (download, open for viewing, or print). See
 * downloadCertificatePdf / viewCertificatePdf / printCertificatePdf below,
 * which are the three actions the Training page exposes and each does
 * exactly one thing with the same generated document.
 */
export const buildCertificateDoc = async (certificate) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const centerX = width / 2;

  // Clean white/light background with a restrained corporate border —
  // no gradients, no gaming-style effects (spec section 6).
  doc.setFillColor(...PDF_COLORS.white);
  doc.rect(0, 0, width, height, "F");
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, width - 16, height - 16);
  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(1.1);
  doc.rect(12, 12, width - 24, height - 24);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.rect(15, 15, width - 30, height - 30);

  // Corner accent geometry + a seal medallion — the structural elements
  // (diagonal corner bands, circular badge) from the reference certificate
  // image, reproduced in the system's own brand palette rather than the
  // reference's unrelated navy/gold scheme (see utils/pdfDesign.js —
  // PDF_COLORS.primary is the same brand red used everywhere else in this
  // app, including the login page and dashboard).
  // Sized and positioned to stay clear of the centered header text and
  // the footer signature blocks (which are inset from the right edge
  // specifically to leave this corner clear — see signBlockWidth/
  // trainerSignX/managerSignX below).
  const GOLD = [201, 162, 39];
  doc.setFillColor(...PDF_COLORS.primary);
  doc.triangle(15, 15, 37, 15, 15, 34, "F");
  doc.setFillColor(...GOLD);
  doc.triangle(15, 15, 28, 15, 15, 24, "F");
  doc.setFillColor(...PDF_COLORS.charcoal);
  doc.triangle(width - 15, height - 15, width - 37, height - 15, width - 15, height - 34, "F");
  doc.setFillColor(...GOLD);
  doc.triangle(width - 15, height - 15, width - 28, height - 15, width - 15, height - 24, "F");

  // Seal medallion (top-right) — concentric circles + a checkmark, with
  // two short ribbon tails beneath, echoing the reference certificate's
  // badge without reproducing its exact artwork.
  const sealX = width - 34;
  const sealY = 34;
  doc.setFillColor(...PDF_COLORS.primary);
  doc.circle(sealX, sealY, 11, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.9);
  doc.circle(sealX, sealY, 8.7);
  doc.setDrawColor(...PDF_COLORS.white);
  doc.setLineWidth(1.3);
  doc.lines(
    [
      [3.2, 3.4],
      [5.4, -6.6]
    ],
    sealX - 4.2,
    sealY + 1.2
  );
  doc.setFillColor(...GOLD);
  doc.triangle(sealX - 5, sealY + 10, sealX - 1.5, sealY + 18, sealX - 1.5, sealY + 9, "F");
  doc.triangle(sealX + 5, sealY + 10, sealX + 1.5, sealY + 18, sealX + 1.5, sealY + 9, "F");

  const logoData = await loadLogoDataUrl();
  let cursorY = 24;
  if (logoData) {
    try {
      const properties = doc.getImageProperties(logoData);
      const ratio = Math.min(18 / properties.width, 12 / properties.height);
      const logoWidth = properties.width * ratio;
      const logoHeight = properties.height * ratio;
      doc.addImage(logoData, undefined, centerX - logoWidth / 2, cursorY - 9, logoWidth, logoHeight);
      cursorY += logoHeight - 5;
    } catch (_error) {
      // Keep the certificate generating even if this browser can't decode the logo.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(ORGANIZATION_NAME.toUpperCase(), centerX, cursorY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${APP_NAME.toUpperCase()} - TRAINING COMPLETION CERTIFICATE`, centerX, cursorY + 9.5, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(23);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text("Training Completion Certificate", centerX, cursorY + 21, { align: "center" });

  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(centerX - 30, cursorY + 24.5, centerX + 30, cursorY + 24.5);

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("This is to certify that", centerX, cursorY + 33, { align: "center" });

  const userName = displayValue(certificate.userName);
  doc.setFont("times", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...PDF_COLORS.charcoal);
  doc.text(userName, centerX, cursorY + 43, { align: "center" });
  const nameWidth = doc.getTextWidth(userName);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(centerX - nameWidth / 2 - 6, cursorY + 45.5, centerX + nameWidth / 2 + 6, cursorY + 45.5);

  doc.setFont("times", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("has successfully completed the safety training program", centerX, cursorY + 53, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(displayValue(certificate.trainingTitle), centerX, cursorY + 60.5, { align: "center" });

  const gridWidth = Math.min(width - 60, 250);
  const gridEnd = drawMetaGrid(doc, {
    centerX,
    width: gridWidth,
    startY: cursorY + 73,
    rows: [
      [
        { label: "Employee ID", value: displayValue(certificate.employeeId) },
        { label: "Role", value: displayValue(certificate.employeeRole) },
        { label: "Department", value: displayValue(certificate.department) },
        { label: "Site / Plaza", value: displayValue(certificate.plaza) }
      ],
      [
        { label: "Training Category", value: displayValue(certificate.trainingCategory) },
        { label: "Training Concept", value: displayValue(certificate.trainingConcept) },
        { label: "Duration", value: formatDuration(certificate.durationMinutes) },
        { label: "Trainer", value: displayValue(certificate.trainerName) }
      ],
      [
        { label: "Completion Date", value: formatCertDate(certificate.completedAt) },
        { label: "Assessment Score", value: formatScore(certificate.assessmentScore) },
        { label: "Completion %", value: `${certificate.completionPercentage ?? 100}%` },
        { label: "Result", value: certificate.result || "Not Assessed" }
      ],
      [
        { label: "Certificate No.", value: displayValue(certificate.certificateNumber) },
        { label: "Issue Date", value: formatCertDate(certificate.issuedAt) },
        { label: "Valid Until", value: certificate.expiresAt ? formatCertDate(certificate.expiresAt) : "No Expiry" }
      ]
    ]
  });

  // Footer: verification (left) and dual signature blocks (right) — a
  // Trainer signature line and a separate Safety Manager / Authorized
  // Signatory line, per spec section 7.
  const footerY = Math.max(gridEnd + 8, height - 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("VERIFICATION", 22, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(`Code: ${displayValue(certificate.verificationCode)}`, 22, footerY + 4.5);
  const verifyOrigin = typeof window !== "undefined" ? window.location.origin : "";
  doc.text(`Verify: ${verifyOrigin}/verify?code=${certificate.verificationCode || ""}`, 22, footerY + 8.5);

  const signBlockWidth = 54;
  // Inset well past the right margin (vs. a plain margin) so the manager
  // signature block never overlaps the bottom-right corner accent
  // triangle drawn near the top of this function.
  const managerSignX = width - signBlockWidth - 42;
  const trainerSignX = managerSignX - signBlockWidth - 10;

  [
    { x: trainerSignX, name: displayValue(certificate.trainerName), title: "Trainer" },
    { x: managerSignX, name: certificate.signatoryName || " ", title: certificate.signatoryTitle || "Authorized Signatory" }
  ].forEach(({ x, name, title }) => {
    doc.setDrawColor(...PDF_COLORS.charcoal);
    doc.setLineWidth(0.3);
    doc.line(x, footerY - 3, x + signBlockWidth, footerY - 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.charcoal);
    doc.text(name, x + signBlockWidth / 2, footerY + 2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(title, x + signBlockWidth / 2, footerY + 6.5, { align: "center" });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(ORGANIZATION_NAME, centerX, height - 18, { align: "center" });

  return doc;
};

const fileNameFor = (certificate) => `Certificate-${certificate.certificateNumber || "training"}.pdf`;

/** Download action — builds the certificate and saves it as a PDF file. */
export const downloadCertificatePdf = async (certificate) => {
  const doc = await buildCertificateDoc(certificate);
  doc.save(fileNameFor(certificate));
};

/** View action — builds the certificate and opens it in a new browser tab. */
export const viewCertificatePdf = async (certificate) => {
  const doc = await buildCertificateDoc(certificate);
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank", "noopener,noreferrer");
};

/**
 * Print action — builds the certificate, opens it, and asks the PDF
 * viewer to trigger the browser's native print dialog (jsPDF's
 * autoPrint()). The user still confirms/cancels printing themselves;
 * nothing is sent to a printer automatically.
 */
export const printCertificatePdf = async (certificate) => {
  const doc = await buildCertificateDoc(certificate);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank", "noopener,noreferrer");
};

// Backward-compatible alias for the original export name.
export const exportCertificatePdf = downloadCertificatePdf;
