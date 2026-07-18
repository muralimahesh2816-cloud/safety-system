const mongoose = require("mongoose");
const connectDb = require("../src/config/db");
const WorkApproval = require("../src/models/WorkApproval");
const {
  getRequestedChainageFrom,
  getRequestedChainageTo,
  parseComparableChainage
} = require("../src/utils/chainage");
const { isPostApprovalStage, normalizeWorkStage, WORK_STAGES } = require("../src/constants/work-status");

const run = async () => {
  await connectDb();
  const records = await WorkApproval.find({})
    .select("requestedChainageFrom requestedChainageTo chainageFrom chainageTo chainage chainageNo approvedChainageFrom approvedChainageTo approvedChainage workflowStage status")
    .lean();

  const report = {
    total: records.length,
    missingRequestedChainage: 0,
    invalidRequestedRange: 0,
    legacyOnlyChainage: 0,
    missingApprovedSnapshotAfterApproval: 0,
    prematureApprovedSnapshot: 0,
    unknownWorkflowStage: 0,
    samples: []
  };

  for (const record of records) {
    const from = getRequestedChainageFrom(record);
    const to = getRequestedChainageTo(record);
    const fromNumber = parseComparableChainage(from);
    const toNumber = parseComparableChainage(to);
    const hasCanonical = Boolean(record.requestedChainageFrom && record.requestedChainageTo);
    const hasApprovedSnapshot = Boolean(
      record.approvedChainageFrom ||
      record.approvedChainageTo ||
      record.approvedChainage?.from ||
      record.approvedChainage?.to
    );
    const postApproval = isPostApprovalStage(record);
    const stage = normalizeWorkStage(record);
    const issues = [];

    if (!from || !to) {
      report.missingRequestedChainage += 1;
      issues.push("missing_requested_chainage");
    } else if (fromNumber !== null && toNumber !== null && toNumber < fromNumber) {
      report.invalidRequestedRange += 1;
      issues.push("invalid_requested_range");
    }
    if (!hasCanonical && (from || to)) {
      report.legacyOnlyChainage += 1;
      issues.push("legacy_only_chainage");
    }
    if (postApproval && !hasApprovedSnapshot) {
      report.missingApprovedSnapshotAfterApproval += 1;
      issues.push("missing_approved_snapshot");
    }
    if (!postApproval && hasApprovedSnapshot) {
      report.prematureApprovedSnapshot += 1;
      issues.push("premature_approved_snapshot");
    }
    if (stage === WORK_STAGES.UNKNOWN) {
      report.unknownWorkflowStage += 1;
      issues.push("unknown_workflow_stage");
    }
    if (issues.length && report.samples.length < 25) {
      report.samples.push({ id: String(record._id), stage, issues, from, to });
    }
  }

  console.log(JSON.stringify(report, null, 2));
};

run()
  .catch((error) => {
    console.error("Work approval audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.connection.close());
