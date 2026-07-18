const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/safety-test";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
process.env.BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-with-enough-length";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-with-enough-length";

const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../src/utils/pagination");
const { getBackupReadiness } = require("../src/services/backup.service");
const {
  normalizeChainagePayload,
  parseComparableChainage,
  validateChainageRange
} = require("../src/utils/chainage");
const {
  isPostApprovalStage,
  normalizeWorkStage,
  WORK_STAGES
} = require("../src/constants/work-status");

test("pagination clamps page and limit values", () => {
  assert.deepEqual(getPagination({ page: "-4", limit: "999" }, { defaultLimit: 25, maxLimit: 100 }), {
    page: 1,
    limit: 100,
    skip: 0
  });
  assert.equal(hasPagination({ page: "2" }), true);
  assert.equal(hasPagination({}), false);
});

test("pagination metadata reports navigation state", () => {
  assert.deepEqual(buildPaginationMeta({ page: 2, limit: 25, total: 80 }), {
    page: 2,
    limit: 25,
    total: 80,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: true
  });
});

test("search values are escaped before creating regular expressions", () => {
  const escaped = escapeRegex("chainage (A)+ [test]?");
  const regex = new RegExp(escaped, "i");
  assert.equal(regex.test("Chainage (A)+ [test]?"), true);
});

test("backup readiness exposes target status without secret values", () => {
  const readiness = getBackupReadiness();
  assert.equal(readiness.success, true);
  assert.equal(readiness.targets.mongodb.uriConfigured, true);
  assert.equal(readiness.targets.configuration.secretsExcludedFromApi, true);
  assert.equal(Object.hasOwn(readiness.targets.configuration, "requiredEnvironment"), true);
});

test("chainage parser normalizes road formats without changing stored text", () => {
  assert.equal(parseComparableChainage("KM 328+500"), 328.5);
  assert.equal(parseComparableChainage("328+500"), 328.5);
  assert.equal(parseComparableChainage("328500"), 328.5);
  assert.equal(parseComparableChainage("328.5"), 328.5);
  assert.deepEqual(
    normalizeChainagePayload({ chainageFrom: "KM 328+500", chainageTo: "KM 329+250" }),
    { requestedChainageFrom: "KM 328+500", requestedChainageTo: "KM 329+250" }
  );
});

test("chainage validation rejects reversed requested ranges", () => {
  const result = validateChainageRange({
    requestedChainageFrom: "KM 330+000",
    requestedChainageTo: "KM 329+500"
  });
  assert.equal(result.valid, false);
  assert.equal(result.field, "chainageTo");
});

test("workflow status normalization keeps full and partial completion separate", () => {
  assert.equal(normalizeWorkStage("Final Approved"), WORK_STAGES.APPROVED);
  assert.equal(normalizeWorkStage("Work Completed"), WORK_STAGES.COMPLETED);
  assert.equal(normalizeWorkStage("Partially Completed"), WORK_STAGES.PARTIALLY_COMPLETED);
  assert.equal(isPostApprovalStage("Pending Final Approval"), false);
  assert.equal(isPostApprovalStage("Approved"), true);
});
