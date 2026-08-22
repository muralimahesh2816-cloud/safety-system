const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/safety-test";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
process.env.BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-with-enough-length";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-with-enough-length";
process.env.REVERSE_GEOCODING_PROVIDER = "none";
process.env.REVERSE_GEOCODING_API_URL = "";

const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination,
  UNPAGINATED_MAX
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
const { allowedRequestHeaders } = require("../src/middleware/security.middleware");
const {
  parseMediaMetadata,
  mergeMediaMetadata,
  redactRecordLocations,
  normalizeLocation,
  normalizeLocationForDisplay
} = require("../src/utils/media-metadata");
const {
  normalizeProviderResponse,
  reverseGeocode,
  validateCoordinates
} = require("../src/services/location.service");
const { ROLES, ROLE_DEFAULT_PERMISSIONS, normalizeRole } = require("../src/constants/roles");
const {
  ASSIGNMENT_STAGES,
  getAssignmentField,
  isEligibleAssigneeRole
} = require("../src/constants/work-assignment");
const {
  createWorkSchema,
  checkWorkSchema,
  recommendWorkSchema,
  updateWorkSchema
} = require("../src/validators/work.validators");
const { updateHazardSchema } = require("../src/validators/hazard.validators");
const WorkApproval = require("../src/models/WorkApproval");
const Hazard = require("../src/models/Hazard");
const Training = require("../src/models/Training");
const User = require("../src/models/User");
const { createTrainingSchema } = require("../src/validators/training.validators");
const {
  ENTERPRISE_HSE_MODULES,
  ENTERPRISE_HSE_KEYS,
  findHseModule,
  canTransition
} = require("../src/constants/enterprise-hse");
const { HSE_MODELS } = require("../src/models/EnterpriseHseRecord");
const { toActionPermissions } = require("../src/middleware/permission.middleware");
const { governanceRules } = require("../src/services/hse-governance.service");

test("supervisor is a creator role without approval-stage authority", () => {
  const workPermissions = ROLE_DEFAULT_PERMISSIONS[ROLES.SUPERVISOR].work;

  assert.equal(workPermissions.view, true);
  assert.equal(workPermissions.create, true);
  assert.equal(workPermissions.check, false);
  assert.equal(workPermissions.recommend, false);
  assert.equal(workPermissions.approve, false);
});

test("enterprise HSE registry exposes every phase one and phase two module", () => {
  assert.equal(ENTERPRISE_HSE_MODULES.filter((module) => module.phase === 1).length, 10);
  assert.equal(ENTERPRISE_HSE_MODULES.filter((module) => module.phase === 2).length, 10);
  assert.equal(new Set(ENTERPRISE_HSE_KEYS).size, 20);
  assert.equal(findHseModule("safety-observations").key, "observations");
});

test("enterprise HSE modules use separate indexed collections", () => {
  const collections = ENTERPRISE_HSE_MODULES.map((module) => HSE_MODELS[module.key].collection.name);
  assert.equal(new Set(collections).size, ENTERPRISE_HSE_MODULES.length);
  const incidentIndexes = HSE_MODELS.incidents.schema.indexes().map(([definition]) => Object.keys(definition).join(","));
  assert.equal(incidentIndexes.includes("assignedTo,status,dueDate"), true);
  assert.equal(incidentIndexes.includes("title,description,site,category,recordId"), true);
});

test("enterprise workflow transitions are governed and permit suspension is explicit", () => {
  const incident = findHseModule("incidents");
  const permit = findHseModule("permits");
  assert.equal(canTransition(incident, "Reported", "Initial Review"), true);
  assert.equal(canTransition(incident, "Reported", "Closed"), false);
  assert.equal(canTransition(permit, "Active", "Suspended"), true);
  assert.equal(canTransition(permit, "Suspended", "Active"), true);
});

test("supervisor is an enterprise HSE creator while viewer remains read-only", () => {
  const supervisor = toActionPermissions({}, ROLES.SUPERVISOR);
  const viewer = toActionPermissions({}, ROLES.VIEWER);
  assert.equal(supervisor.incidents.view, true);
  assert.equal(supervisor.incidents.create, true);
  assert.equal(supervisor.permits.update, true);
  assert.equal(viewer.incidents.view, true);
  assert.equal(viewer.incidents.create, false);
  assert.equal(viewer.capa.delete, false);
});

test("HSE governance defines overdue and expiry automation without closing records silently", () => {
  const rules = governanceRules(new Date("2026-08-04T00:00:00.000Z"));
  assert.equal(rules.some((rule) => rule.module === "capa" && rule.status === "Overdue"), true);
  assert.equal(rules.some((rule) => rule.module === "compliance-calendar" && rule.status === "Due Soon"), true);
  assert.equal(rules.some((rule) => rule.module === "competency-matrix" && rule.status === "Expired"), true);
  assert.equal(rules.some((rule) => rule.status === "Closed"), false);
});

test("legacy misspelled manager roles normalize to canonical roles", () => {
  assert.equal(normalizeRole("project_manger"), ROLES.PROJECT_MANAGER);
  assert.equal(normalizeRole("maintance manager"), ROLES.MAINTENANCE_MANAGER);
  assert.equal(normalizeRole("safety_manger"), ROLES.SAFETY_MANAGER);
});

test("workflow assignment roles and fields are stage specific", () => {
  assert.equal(isEligibleAssigneeRole(ASSIGNMENT_STAGES.CHECK, ROLES.SAFETY_ENGINEER), true);
  assert.equal(isEligibleAssigneeRole(ASSIGNMENT_STAGES.CHECK, ROLES.SAFETY_MANAGER), false);
  assert.equal(isEligibleAssigneeRole(ASSIGNMENT_STAGES.RECOMMENDATION, ROLES.SAFETY_MANAGER), true);
  assert.equal(isEligibleAssigneeRole(ASSIGNMENT_STAGES.FINAL_APPROVAL, ROLES.PROJECT_MANAGER), true);
  assert.equal(getAssignmentField(ASSIGNMENT_STAGES.FINAL_APPROVAL), "assignedFinalApprover");
});

test("work creation and transitions require the next named assignee", () => {
  const baseWork = {
    workType: "Road maintenance",
    location: "KM 320",
    requestedChainageFrom: "KM 320+000",
    requestedChainageTo: "KM 320+500",
    workersCount: 4
  };
  assert.equal(createWorkSchema.safeParse(baseWork).success, false);
  assert.equal(createWorkSchema.safeParse({ ...baseWork, assignedCheckerId: "507f1f77bcf86cd799439011" }).success, true);
  assert.equal(checkWorkSchema.safeParse({ reviewFindings: "Checked" }).success, false);
  assert.equal(checkWorkSchema.safeParse({ reviewFindings: "Checked", assignedRecommenderId: "507f1f77bcf86cd799439012" }).success, true);
  assert.equal(recommendWorkSchema.safeParse({ recommendationRemarks: "Recommended" }).success, false);
});

test("work assignment indexes support assigned-to-me stage queues", () => {
  const indexFields = WorkApproval.schema.indexes().map(([definition]) => Object.keys(definition).join(","));
  assert.equal(indexFields.includes("assignedChecker,workflowStage,createdAt"), true);
  assert.equal(indexFields.includes("assignedRecommender,workflowStage,createdAt"), true);
  assert.equal(indexFields.includes("assignedFinalApprover,workflowStage,createdAt"), true);
});

test("CORS allows work submission idempotency and security headers", () => {
  const normalizedHeaders = allowedRequestHeaders.map((header) => header.toLowerCase());
  assert.equal(normalizedHeaders.includes("idempotency-key"), true);
  assert.equal(normalizedHeaders.includes("x-csrf-token"), true);
  assert.equal(normalizedHeaders.includes("authorization"), true);
});

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

test("media metadata accepts device evidence and never marks it cryptographically verified", () => {
  const [metadata] = parseMediaMetadata(JSON.stringify([{
    captureSource: "camera",
    originalFileName: "site.jpg",
    location: {
      latitude: 13.340512,
      longitude: 74.702315,
      accuracyMeters: 18,
      capturedAt: new Date().toISOString(),
      permissionStatus: "granted",
      isVerified: true
    },
    watermark: { applied: true, processingStatus: "completed" }
  }]), { module: "work_approval", stage: "before", mediaType: "image", maxCount: 10 });
  const [asset] = mergeMediaMetadata([
    { url: "https://media.example/site.jpg", originalName: "site-stamped.jpg", size: 1200 }
  ], [metadata], {
    userId: "507f1f77bcf86cd799439011",
    module: "work_approval",
    stage: "before",
    mediaType: "image"
  });
  assert.equal(asset.captureSource, "camera");
  assert.equal(asset.location.isVerified, false);
  assert.equal(asset.watermarkedUrl, asset.url);
});

test("media metadata rejects invalid GPS ranges", () => {
  assert.throws(
    () => parseMediaMetadata(JSON.stringify([{
      captureSource: "camera",
      location: { latitude: 91, longitude: 74, accuracyMeters: 10 }
    }]), { module: "hazard", stage: "before", mediaType: "image", maxCount: 6 }),
    /latitude must be between -90 and 90/
  );
});

test("every authorized parent-record viewer receives the same normalized location fields", () => {
  const record = {
    createdBy: "507f1f77bcf86cd799439012",
    geoLocation: { latitude: 13.34, longitude: 74.7, formattedAddress: "Record address", placeId: "internal-place" },
    beforeImages: [{ publicId: "storage-public-id", location: { latitude: 13.34, longitude: 74.7, accuracyMeters: 20, formattedAddress: "Site address", reverseGeocodeProvider: "internal-provider" } }],
    locationAuditHistory: [{
      reason: "Correction",
      updatedBy: "507f1f77bcf86cd799439099",
      previousLocation: { latitude: 13.33, longitude: 74.69, placeId: "previous-internal-place" },
      newLocation: { latitude: 13.34, longitude: 74.7, reverseGeocodeProvider: "internal-provider" }
    }]
  };
  const viewerResult = redactRecordLocations(record, {
    id: "507f1f77bcf86cd799439013",
    role: "viewer"
  }, ["beforeImages"]);
  const adminResult = redactRecordLocations(record, { role: ROLES.ADMIN }, ["beforeImages"]);
  assert.deepEqual(viewerResult.beforeImages[0].location, adminResult.beforeImages[0].location);
  assert.equal(viewerResult.beforeImages[0].location.latitude, 13.34);
  assert.equal(viewerResult.beforeImages[0].location.formattedAddress, "Site address");
  assert.equal(viewerResult.geoLocation.longitude, 74.7);
  assert.equal(viewerResult.beforeImages[0].location.reverseGeocodeProvider, undefined);
  assert.equal(viewerResult.beforeImages[0].publicId, undefined);
  assert.equal(viewerResult.geoLocation.placeId, undefined);
  assert.equal(viewerResult.locationAuditHistory[0].updatedBy, undefined);
  assert.equal(viewerResult.locationAuditHistory[0].newLocation.reverseGeocodeProvider, undefined);
});

test("display location normalizer supports legacy field names and GeoJSON", () => {
  const legacy = normalizeLocationForDisplay({
    lat: 13.494759,
    lng: 74.719246,
    address: "Legacy address",
    accuracy: 18,
    timestamp: "2026-07-20T10:52:00.000Z"
  });
  const geoJson = normalizeLocationForDisplay({
    type: "Point",
    coordinates: [74.719246, 13.494759]
  });
  assert.equal(legacy.latitude, 13.494759);
  assert.equal(legacy.longitude, 74.719246);
  assert.equal(legacy.formattedAddress, "Legacy address");
  assert.equal(geoJson.latitude, 13.494759);
  assert.equal(geoJson.longitude, 74.719246);
  assert.equal(normalizeLocationForDisplay({}), null);
});

test("generic record updates reject GPS metadata", () => {
  assert.equal(updateWorkSchema.safeParse({ geoLocation: { latitude: 13, longitude: 74 } }).success, false);
  assert.equal(updateHazardSchema.safeParse({ latitude: 13, longitude: 74 }).success, false);
});

test("record locations preserve safe provenance and map preferences", () => {
  const location = normalizeLocation({
    latitude: 13.476205,
    longitude: 74.713226,
    locationSource: "map_adjusted",
    mapType: "satellite",
    zoom: 19,
    placeId: "sample-place"
  }, "record");
  assert.equal(location.locationSource, "map_adjusted");
  assert.equal(location.mapType, "satellite");
  assert.equal(location.zoom, 19);
  assert.equal(location.placeId, "sample-place");
});

test("reverse geocoding normalizes a complete provider address", () => {
  const normalized = normalizeProviderResponse({
    data: {
      formattedAddress: "Karkada Badaholi and Mooduholi, Saligrama, Karnataka 576225",
      addressLine1: "Karkada Badaholi and Mooduholi",
      locality: "Saligrama",
      district: "Udupi",
      state: "Karnataka",
      postalCode: "576225",
      country: "India"
    }
  }, "generic", { latitude: 13.494759, longitude: 74.719246 });
  assert.equal(normalized.formattedAddress, "Karkada Badaholi and Mooduholi, Saligrama, Karnataka 576225");
  assert.equal(normalized.postalCode, "576225");
  assert.equal(normalized.latitude, 13.494759);
});

test("location service rejects invalid longitude", () => {
  assert.throws(() => validateCoordinates(13, 181), /Longitude must be a number between -180 and 180/);
});

test("location service preserves coordinates when no provider is configured", async () => {
  const result = await reverseGeocode(13.494759, 74.719246, { requestId: "test-request" });
  assert.equal(result.latitude, 13.494759);
  assert.equal(result.longitude, 74.719246);
  assert.equal(result.formattedAddress, "Address unavailable");
  assert.equal(result.reverseGeocodeStatus, "unavailable");
});


test("list endpoints without pagination parameters are still capped", () => {
  // A caller that sends no page/limit gets a single response, but never an
  // unbounded one — hazards and training documents carry embedded media and
  // completion arrays, so an uncapped list grew without limit.
  assert.equal(hasPagination({}), false);
  assert.ok(Number.isInteger(UNPAGINATED_MAX));
  assert.ok(UNPAGINATED_MAX > 0 && UNPAGINATED_MAX <= 1000);
});

test("indexes exist for the aggregations the dashboard runs on every load", () => {
  const indexKeys = (model) => model.schema.indexes().map(([fields]) => JSON.stringify(fields));

  // The monthly-trend facets match on createdAt / lastLoginAt alone, which no
  // compound index above them can serve (createdAt is never the leading field).
  assert.ok(indexKeys(WorkApproval).includes(JSON.stringify({ createdAt: -1 })));
  assert.ok(indexKeys(Hazard).includes(JSON.stringify({ createdAt: -1 })));
  assert.ok(indexKeys(User).includes(JSON.stringify({ lastLoginAt: -1 })));
  assert.ok(indexKeys(Training).includes(JSON.stringify({ "completions.completedAt": -1 })));
});

test("training carries optional structured HSE content without breaking legacy records", () => {
  const paths = Training.schema.paths;
  ["objective", "catalogId", "visualKey"].forEach((field) => {
    assert.equal(paths[field].options.default, "", `${field} must default to an empty string`);
  });
  ["hazards", "correctPractice", "incorrectPractice", "requiredPpe"].forEach((field) => {
    assert.deepEqual(paths[field].options.default, [], `${field} must default to an empty array`);
  });

  // A pre-upgrade payload with none of the new fields must still validate.
  const legacy = createTrainingSchema.safeParse({
    title: "Toolbox Talk",
    description: "Daily briefing",
    category: "General"
  });
  assert.equal(legacy.success, true);
  assert.deepEqual(legacy.data.hazards, []);
  assert.equal(legacy.data.objective, "");
});

test("training content lists accept multipart JSON strings and reject malformed input", () => {
  const parsed = createTrainingSchema.safeParse({
    title: "Working at Height",
    description: "Fall protection",
    category: "Construction Site Safety",
    hazards: JSON.stringify(["Falls from open edges", "   ", "Dropped tools"]),
    correctPractice: ["Harness attached to a rated anchor"]
  });
  assert.equal(parsed.success, true);
  // Blank entries are dropped rather than stored as empty bullet points.
  assert.deepEqual(parsed.data.hazards, ["Falls from open edges", "Dropped tools"]);
  assert.deepEqual(parsed.data.correctPractice, ["Harness attached to a rated anchor"]);

  const malformed = createTrainingSchema.safeParse({
    title: "Working at Height",
    description: "Fall protection",
    category: "Construction Site Safety",
    hazards: "not-json"
  });
  assert.equal(malformed.success, false);
});
