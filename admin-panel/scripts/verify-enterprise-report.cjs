const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTablePackage = require("jspdf-autotable");

const autoTable = autoTablePackage.default || autoTablePackage.autoTable;
const outputDirectory = path.resolve(__dirname, "../../tmp/pdfs");
const outputPath = path.join(outputDirectory, "enterprise-hse-register-sample.pdf");
fs.mkdirSync(outputDirectory, { recursive: true });

const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
doc.setProperties({
  title: "Incident Management Register",
  subject: "Enterprise HSE controlled report visual verification",
  author: "Udupi Tollway Pvt. Ltd.",
  creator: "Safety Management System"
});
doc.setFillColor(8, 47, 73);
doc.rect(0, 0, 297, 28, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.text("Udupi Tollway Pvt. Ltd.", 14, 11);
doc.setFontSize(11);
doc.text("Incident Management - Controlled Register", 14, 20);
doc.setTextColor(30, 41, 59);
doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.text("Generated: 04/08/2026, 1:30 pm | Records: 5", 14, 34);
doc.text("Filters: status: Investigation | site: Toll Plaza", 14, 39);

const columns = ["Record ID", "Title", "Category", "Site", "Status", "Severity", "Priority", "Due Date", "Expiry Date", "Assigned To"];
const rows = [
  ["INC-82AF109C", "Vehicle contact at entry barrier", "Vehicle", "Surathkal Toll Plaza", "Investigation", "High", "Urgent", "08/08/2026", "-", "Safety Officer"],
  ["INC-82AF109D", "Minor hand injury during maintenance", "Injury", "Hejmady Toll Plaza", "Corrective Action", "Medium", "High", "10/08/2026", "-", "Maintenance Engineer"],
  ["INC-82AF109E", "Oil spill near generator enclosure", "Environmental", "Kundapura Site", "Initial Review", "High", "High", "06/08/2026", "-", "Site Engineer"],
  ["INC-82AF109F", "Smoke detector activation", "Fire", "Admin Building", "Verification", "Low", "Medium", "04/08/2026", "-", "Safety Manager"],
  ["INC-82AF10A0", "Unauthorized pedestrian entered lane", "Security", "Sasthan Toll Plaza", "Reported", "Medium", "High", "05/08/2026", "-", "Operations Manager"]
];

autoTable(doc, {
  startY: 44,
  head: [columns],
  body: rows,
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

fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
process.stdout.write(outputPath);
