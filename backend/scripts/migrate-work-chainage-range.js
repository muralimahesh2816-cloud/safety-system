const mongoose = require("mongoose");
const connectDb = require("../src/config/db");
const WorkApproval = require("../src/models/WorkApproval");

const getFallbackChainage = (record = {}) =>
  String(record.chainageNo || record.chainage || record.chainageFrom || "").trim();

const run = async () => {
  await connectDb();

  const records = await WorkApproval.find({
    $or: [
      { chainageFrom: { $exists: false } },
      { chainageFrom: "" },
      { chainageFrom: null },
      { chainageTo: { $exists: false } },
      { chainageTo: "" },
      { chainageTo: null }
    ]
  }).select("chainage chainageNo chainageFrom chainageTo");

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    const fallback = getFallbackChainage(record);
    if (!fallback) {
      skipped += 1;
      continue;
    }

    const $set = {};
    if (!record.chainageFrom) $set.chainageFrom = fallback;
    if (!record.chainageTo) $set.chainageTo = record.chainageFrom || fallback;

    if (Object.keys($set).length) {
      await WorkApproval.updateOne({ _id: record._id }, { $set });
      migrated += 1;
    }
  }

  console.log(`Work chainage migration complete. Migrated: ${migrated}. Skipped: ${skipped}.`);
};

run()
  .catch((error) => {
    console.error("Work chainage migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
