import jsPDF from "jspdf";
import companyLogoUrl from "../assets/vertis-logo.svg";
import { APP_NAME, ORGANIZATION_NAME } from "../config/appConfig";
import { PDF_COLORS } from "./pdfDesign";

const formatCertDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
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

/**
 * Renders a formal, printable "Certificate of Completion" for a training
 * record and triggers a PDF download. A2 verification note: since a real
 * scannable QR image needs a QR-generation dependency this environment
 * couldn't install/verify, the certificate instead prints the
 * certificate number and verification code, plus the /verify page path
 * that resolves them (see pages/VerifyCertificatePage.jsx + the public
 * GET /certificates/verify/:code backend route). Swap in a real QR image
 * later by adding e.g. `qrcode` and calling doc.addImage with its output
 * where the QR_PLACEHOLDER block is drawn below.
 */
export const exportCertificatePdf = async (certificate) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const centerX = width / 2;

  // Frame
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, width - 16, height - 16);
  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(1.1);
  doc.rect(12, 12, width - 24, height - 24);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.rect(15, 15, width - 30, height - 30);

  const logoData = await loadLogoDataUrl();
  let cursorY = 26;
  if (logoData) {
    try {
      const properties = doc.getImageProperties(logoData);
      const ratio = Math.min(20 / properties.width, 14 / properties.height);
      const logoWidth = properties.width * ratio;
      const logoHeight = properties.height * ratio;
      doc.addImage(logoData, undefined, centerX - logoWidth / 2, cursorY - 10, logoWidth, logoHeight);
      cursorY += logoHeight - 4;
    } catch (_error) {
      // Keep the certificate generating even if this browser can't decode the logo.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(ORGANIZATION_NAME.toUpperCase(), centerX, cursorY + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${APP_NAME} - HSE Training Program`, centerX, cursorY + 11, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text("Certificate of Completion", centerX, cursorY + 26, { align: "center" });

  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(centerX - 34, cursorY + 30, centerX + 34, cursorY + 30);

  doc.setFont("times", "italic");
  doc.setFontSize(11.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("This is to certify that", centerX, cursorY + 42, { align: "center" });

  const userName = certificate.userName || "-";
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...PDF_COLORS.charcoal);
  doc.text(userName, centerX, cursorY + 55, { align: "center" });
  const nameWidth = doc.getTextWidth(userName);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(centerX - nameWidth / 2 - 6, cursorY + 58, centerX + nameWidth / 2 + 6, cursorY + 58);

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("has successfully completed the safety training program", centerX, cursorY + 68, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.primary);
  const trainingLine = certificate.trainingTitle || "-";
  doc.text(trainingLine, centerX, cursorY + 77, { align: "center" });

  // Meta row: completion date | certificate number | valid until
  const metaY = cursorY + 92;
  const columns = [
    { label: "Completion Date", value: formatCertDate(certificate.completedAt) },
    { label: "Certificate No.", value: certificate.certificateNumber || "-" },
    { label: "Valid Until", value: certificate.expiresAt ? formatCertDate(certificate.expiresAt) : "No expiry" }
  ];
  const columnWidth = 70;
  const totalWidth = columnWidth * columns.length;
  const startX = centerX - totalWidth / 2;
  columns.forEach((column, index) => {
    const colCenter = startX + columnWidth * index + columnWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(column.label.toUpperCase(), colCenter, metaY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_COLORS.charcoal);
    doc.text(column.value, colCenter, metaY + 6, { align: "center" });
    if (index > 0) {
      doc.setDrawColor(...PDF_COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(startX + columnWidth * index, metaY - 4, startX + columnWidth * index, metaY + 8);
    }
  });

  // Footer: verification (left) and signature block (right)
  const footerY = height - 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("VERIFICATION", 26, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(`Code: ${certificate.verificationCode || "-"}`, 26, footerY + 5);
  const verifyOrigin = typeof window !== "undefined" ? window.location.origin : "";
  doc.text(`Verify: ${verifyOrigin}/verify?code=${certificate.verificationCode || ""}`, 26, footerY + 9.5);

  const signX = width - 90;
  doc.setDrawColor(...PDF_COLORS.charcoal);
  doc.setLineWidth(0.3);
  doc.line(signX, footerY - 2, signX + 64, footerY - 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.charcoal);
  doc.text(certificate.signatoryName || " ", signX + 32, footerY + 3, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(certificate.signatoryTitle || "Authorized Signatory", signX + 32, footerY + 8, { align: "center" });
  doc.text(`Date of Issue: ${formatCertDate(certificate.issuedAt)}`, signX + 32, footerY + 13, { align: "center" });

  doc.save(`Certificate-${certificate.certificateNumber || "training"}.pdf`);
};
