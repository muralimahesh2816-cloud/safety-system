const mongoose = require("mongoose");
const connectDb = require("../src/config/db");
const WorkApproval = require("../src/models/WorkApproval");
const {
  getRequestedChainageFrom,
  getRequestedChainageTo,
  parseComparableChainage
} = require("../src/utils/chainage");
const { isPostApprovalStage } = require("../src/constants/work-status");

const applyChanges = process.argv.includes("--apply");

const run = async () => {
  await connectDb();
  const records = await WorkApproval.find({})
    .select("requestedChainageFrom requestedChainageTo chainageFrom chainageTo chainage chainageNo approvedChainageFrom approvedChainageTo approvedChainage workflowStage status")
    .lean();
  const summary = { mode: applyChanges ? "apply" : "dry-run", scanned: records.length, updated: 0, unchanged: 0, invalid: 0 };

  for (const record of records) {
    const requestedFrom = getRequestedChainageFrom(record);
    const requestedTo = getRequestedChainageTo(record);
    const fromNumber = parseComparableChainage(requestedFrom);
    const toNumber = parseComparableChainage(requestedTo);
    if (!requestedFrom || !requestedTo || (fromNumber !== null && toNumber !== null && toNumber < fromNumber)) {
      summary.invalid += 1;
      continue;
    }

    const $set = {};
    if (!record.requestedChainageFrom) $set.requestedChainageFrom = requestedFrom;
    if (!record.requestedChainageTo) $set.requestedChainageTo = requestedTo;

    if (isPostApprovalStage(record)) {
      const approvedFrom = String(record.approvedChainageFrom || record.approvedChainage?.from || requestedFrom).trim();
      const approvedTo = String(record.approvedChainageTo || record.approvedChainage?.to || requestedTo).trim();
      if (!record.approvedChainageFrom) $set.approvedChainageFrom = approvedFrom;
      if (!record.approvedChainageTo) $set.approvedChainageTo = approvedTo;
      if (!record.approvedChainage?.from) $set["approvedChainage.from"] = approvedFrom;
      if (!record.approvedChainage?.to) $set["approvedChainage.to"] = approvedTo;
    }

    if (!Object.keys($set).length) {
      summary.unchanged += 1;
      continue;
    }
    if (applyChanges) await WorkApproval.updateOne({ _id: record._id }, { $set });
    summary.updated += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!applyChanges) console.log("Dry run only. Re-run with --apply after reviewing the audit output and taking a database backup.");
};

run()
  .catch((error) => {
    console.error("Work approval chainage migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.connection.close());
