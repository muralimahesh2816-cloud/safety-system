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
