import { PDF_COLORS, PDF_LAYOUT } from "./pdfDesign";
import { getPdfReportColumns } from "./pdfExport";

test("uses the Vertis A4 report design tokens", () => {
  expect(PDF_LAYOUT).toMatchObject({ format: "a4", unit: "mm" });
  expect(PDF_LAYOUT.margin).toEqual({ top: 46, right: 14, bottom: 22, left: 14 });
  expect(PDF_COLORS.primary).toEqual([155, 20, 0]);
});

test("training PDF exposes useful official fields", () => {
  const headers = getPdfReportColumns("training").map((column) => column.header);
  expect(headers).toEqual(expect.arrayContaining(["Training Title", "Concept", "Trainer", "Location", "Remarks"]));
  expect(headers).not.toContain("_id");
});

test("work report uses the approved 16-column order", () => {
  const headers = getPdfReportColumns("work").map((column) => column.header);
  expect(headers).toEqual([
    "Approval No",
    "Date",
    "Work Type",
    "Location",
    "Requested Chainage",
    "Approved Chainage",
    "Completed Chainage",
    "Completion %",
    "Workers",
    "Created By",
    "Created Role",
    "Workflow Stage",
    "Checked By",
    "Recommended By",
    "Approved By",
    "Status"
  ]);
});
