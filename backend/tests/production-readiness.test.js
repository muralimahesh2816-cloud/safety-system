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
const { normalizePhone, maskPhone, toWhatsAppRecipient } = require("../src/utils/phone");
const OutboundMessage = require("../src/models/OutboundMessage");
const { BACKOFF_MS, MAX_ATTEMPTS } = require("../src/services/outbound-queue.service");
const templates = require("../src/services/message-templates");
const WorkAttendance = require("../src/models/WorkAttendance");
const {
  buildQrPayload,
  generateWorkerCode,
  verifyQrPayload
} = require("../src/services/worker-qr.service");
const {
  buildWorkSessionKey,
  canRemoveAttendance,
  canScanAttendance,
  isAttendanceOpenStage
} = require("../src/constants/work-attendance");
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


test("a worker QR badge carries no personal data and no database id", () => {
  const code = generateWorkerCode();
  const payload = buildQrPayload(code);
  const [namespace, kind, encodedCode] = payload.split(":");

  assert.equal(namespace, "UTPLHSE1");
  assert.equal(kind, "W");
  assert.equal(encodedCode, code);
  assert.equal(payload.split(":").length, 4);

  // Nothing identifying may appear anywhere in the printed payload.
  ["@", "murali", "UTPL00125", "safety_officer", "eyJ"].forEach((leak) => {
    assert.ok(!payload.toLowerCase().includes(leak.toLowerCase()), `payload leaked ${leak}`);
  });
});

test("a worker QR badge round-trips and rejects every tampering attempt", () => {
  const code = generateWorkerCode();
  const payload = buildQrPayload(code);

  const good = verifyQrPayload(payload);
  assert.equal(good.valid, true);
  assert.equal(good.workerCode, code);

  // Swapping in another worker's code invalidates the signature, so a badge
  // cannot be edited to impersonate a different worker.
  const otherCode = generateWorkerCode();
  const forged = payload.replace(code, otherCode);
  assert.equal(verifyQrPayload(forged).valid, false);
  assert.equal(verifyQrPayload(forged).reason, "SIGNATURE_INVALID");

  // A hand-written payload with no signature is rejected.
  assert.equal(verifyQrPayload(`UTPLHSE1:W:${code}:`).valid, false);
  assert.equal(verifyQrPayload(`UTPLHSE1:W:${code}`).valid, false);

  // Arbitrary QR content the camera might resolve is rejected, not crashed on.
  ["", "   ", "https://example.com", "OTHERNS:W:abc:def", "UTPLHSE1:X:abc:def",
   null, undefined, 42, {}, "A".repeat(400)].forEach((input) => {
    assert.equal(verifyQrPayload(input).valid, false);
  });
});

test("regenerating a worker code invalidates the previously printed badge", () => {
  const oldCode = generateWorkerCode();
  const oldPayload = buildQrPayload(oldCode);
  const newCode = generateWorkerCode();

  assert.notEqual(oldCode, newCode);
  // The old payload still verifies cryptographically — it is the *lookup* that
  // fails, because no user holds that code any more. That is the intended
  // design: the signature proves issuance, the database row proves currency.
  assert.equal(verifyQrPayload(oldPayload).workerCode, oldCode);
  assert.notEqual(verifyQrPayload(oldPayload).workerCode, newCode);
});

test("attendance is restricted to site supervisory roles, removal more narrowly", () => {
  // Holding a badge does not confer the right to scan one.
  assert.equal(canScanAttendance("employee"), false);
  assert.equal(canScanAttendance("user"), false);
  assert.equal(canScanAttendance("viewer"), false);

  ["safety_officer", "site_engineer", "safety_manager", "admin", "super_admin"].forEach((role) => {
    assert.equal(canScanAttendance(role), true, `${role} should be able to scan`);
  });

  // Removing attendance rewrites safety evidence, so it is narrower than
  // recording it: a Safety Officer may scan but may not delete.
  assert.equal(canRemoveAttendance("safety_officer"), false);
  assert.equal(canRemoveAttendance("site_engineer"), false);
  assert.equal(canRemoveAttendance("safety_manager"), true);
  assert.equal(canRemoveAttendance("admin"), true);
});

test("attendance is only open between approval and close-out", () => {
  assert.equal(isAttendanceOpenStage(WORK_STAGES.APPROVED), true);
  assert.equal(isAttendanceOpenStage(WORK_STAGES.WORK_IN_PROGRESS), true);
  assert.equal(isAttendanceOpenStage(WORK_STAGES.PARTIALLY_COMPLETED), true);

  // Not before approval...
  assert.equal(isAttendanceOpenStage(WORK_STAGES.PENDING_CHECK), false);
  assert.equal(isAttendanceOpenStage(WORK_STAGES.PENDING_RECOMMENDATION), false);
  assert.equal(isAttendanceOpenStage(WORK_STAGES.PENDING_FINAL_APPROVAL), false);
  assert.equal(isAttendanceOpenStage(WORK_STAGES.RETURNED), false);
  // ...and not after close-out.
  assert.equal(isAttendanceOpenStage(WORK_STAGES.COMPLETED), false);
});

test("duplicate attendance is prevented by a unique index, not a read check", () => {
  // Two scanners on site can pass a read-then-write check simultaneously; only
  // the database can actually reject the second write.
  const indexes = WorkAttendance.schema.indexes();
  const guard = indexes.find(([fields]) =>
    fields.workApproval === 1 && fields.workSessionKey === 1 && fields.worker === 1
  );

  assert.ok(guard, "expected a (workApproval, workSessionKey, worker) index");
  assert.equal(guard[1].unique, true);
  // Partial, so removing an attendance record frees the worker to be re-added.
  assert.deepEqual(guard[1].partialFilterExpression, { status: "present" });
});

test("a work session defaults to the calendar date and supports named shifts", () => {
  assert.equal(buildWorkSessionKey(new Date("2026-08-24T10:35:00Z")), "2026-08-24");
  assert.equal(buildWorkSessionKey(new Date("2026-08-24T10:35:00Z"), "night"), "2026-08-24:night");
});

test("attendance snapshots the worker so historical records survive personnel changes", () => {
  const paths = WorkAttendance.schema.paths;
  assert.equal(paths.workerName.isRequired, true);
  ["employeeId", "workerRole", "scannedByName", "scannedByRole"].forEach((field) => {
    assert.ok(paths[field], `expected snapshot field ${field}`);
  });
  // The live reference is kept alongside the snapshot.
  assert.equal(paths.worker.options.ref, "User");
  // Removal is a status change, never a hard delete — attendance is evidence.
  assert.deepEqual(paths.status.enumValues, ["present", "removed"]);
});


test("a worker QR id is human-readable, prefixed and unique per issue", () => {
  const codes = Array.from({ length: 200 }, () => generateWorkerCode());

  codes.forEach((code) => {
    // WRK-<16 hex>: quotable over radio and printable under the badge.
    assert.match(code, /^WRK-[0-9A-F]{16}$/, `unexpected worker code shape: ${code}`);
  });

  // 64 bits of randomness — a collision inside one issuing run would indicate
  // the generator is not actually random.
  assert.equal(new Set(codes).size, codes.length);

  // It must not be derivable from anything about the employee.
  const payload = buildQrPayload(codes[0]);
  assert.ok(payload.includes(codes[0]));
  assert.equal(verifyQrPayload(payload).workerCode, codes[0]);
});

test("worker codes issued before the WRK- format still verify", () => {
  // Existing badges must keep working — a format change cannot silently
  // invalidate every card already printed and handed out.
  const legacy = "RgexILhvpyr72qNZuzxB5g";
  const result = verifyQrPayload(buildQrPayload(legacy));
  assert.equal(result.valid, true);
  assert.equal(result.workerCode, legacy);
});

test("the worker code is uniquely indexed so two workers cannot share a badge", () => {
  const guard = User.schema
    .indexes()
    .find(([fields]) => Object.keys(fields).length === 1 && fields.workerCode === 1);

  assert.ok(guard, "expected a workerCode index");
  assert.equal(guard[1].unique, true);
  // PARTIAL, not sparse. `workerCode` defaults to "" and a sparse index still
  // indexes a stored "", so a sparse unique index made it impossible to create
  // a second user who had not been issued a badge.
  assert.ok(guard[1].partialFilterExpression, "workerCode uniqueness must be partial, not sparse");
  assert.equal(guard[1].sparse, undefined);
});

test("the worker code is never returned by an ordinary user query", () => {
  // `select: false` keeps the badge identity out of /users, user detail and
  // every other response that did not explicitly ask for it.
  assert.equal(User.schema.paths.workerCode.options.select, false);
});


test("every way a person types their number resolves to one identity", () => {
  // If these diverge, the unique index is meaningless and OTP login silently
  // fails for anyone whose number was stored in a different shape.
  const variants = [
    "9876543210", "+91 98765 43210", "+919876543210", "09876543210",
    "0091 9876543210", "919876543210", "98765-43210", "(98765) 43210"
  ];
  const resolved = new Set(variants.map((v) => normalizePhone(v).e164));
  assert.equal(resolved.size, 1, `expected one identity, got ${[...resolved]}`);
  assert.equal([...resolved][0], "+919876543210");
});

test("invalid mobile numbers are rejected rather than stored", () => {
  [
    ["1234567890", "NOT_A_MOBILE"],      // valid length, invalid Indian prefix
    ["98765", "INVALID_LENGTH"],
    ["abcdefghij", "INVALID_CHARACTERS"],
    ["", "EMPTY"],
    ["+9998765432101", "UNSUPPORTED_COUNTRY"]
  ].forEach(([input, reason]) => {
    const result = normalizePhone(input);
    assert.equal(result.ok, false, `${input} should be rejected`);
    assert.equal(result.reason, reason);
  });
});

test("a mobile number is never exposed in full", () => {
  const masked = maskPhone("+919876543210");
  assert.ok(masked.endsWith("3210"), "last four digits identify the number to its owner");
  assert.ok(!masked.includes("98765"), "the rest must not be disclosed");
  assert.equal(masked, "+91 ******3210");
  // WhatsApp wants it without the "+", and that is the only place the full
  // number is reconstructed.
  assert.equal(toWhatsAppRecipient("+919876543210"), "919876543210");
});

test("assignment messages carry no credentials and no auth-bearing link", () => {
  const body = templates.workAssignment({
    name: "Ravi Kumar",
    approvalNo: "WA-2026-000123",
    workType: "Road Work",
    location: "Plaza A",
    chainage: "CH 5+000 to CH 5+400",
    role: "safety officer",
    assignedBy: "Site Engineer",
    action: "Check this work approval",
    recordId: "6a8c138e223dc30a31377010"
  });

  assert.ok(body.includes("WA-2026-000123"));
  assert.ok(body.includes("Ravi Kumar"));
  // A forwarded WhatsApp message must never be a way into someone's account.
  [/token=/i, /jwt/i, /Bearer /i, /otp/i, /password/i, /[?&]auth/i].forEach((pattern) => {
    assert.ok(!pattern.test(body), `assignment message leaked ${pattern}`);
  });
});

test("the OTP message warns against sharing and carries only the code", () => {
  const body = templates.loginOtp({ name: "Ravi", otp: "123456", expiresInMinutes: 5 });
  assert.ok(body.includes("123456"));
  assert.ok(/never ask you for it/i.test(body));
  assert.ok(!/password/i.test(body));
});

test("outbound delivery is retried with bounded exponential backoff", () => {
  // Bounded on purpose: a permanently bad number must end as a visible
  // `failed` row that someone can act on, not an endless retry loop.
  assert.equal(MAX_ATTEMPTS, 3);
  assert.deepEqual(BACKOFF_MS, [60000, 300000, 900000]);
  for (let i = 1; i < BACKOFF_MS.length; i += 1) {
    assert.ok(BACKOFF_MS[i] > BACKOFF_MS[i - 1], "backoff must increase");
  }
});

test("outbound messages record the full delivery lifecycle", () => {
  const paths = OutboundMessage.schema.paths;
  ["recipient", "recipientPhone", "event", "status", "attempts", "providerMessageId",
   "sentAt", "failureReason", "nextAttemptAt", "relatedModule", "relatedRecordId"].forEach((field) => {
    assert.ok(paths[field], `expected delivery field ${field}`);
  });
  assert.deepEqual(paths.status.enumValues, ["pending", "sending", "sent", "failed", "skipped"]);

  // The queue claim query must be indexed — it runs on every poll.
  const claim = OutboundMessage.schema.indexes()
    .find(([fields]) => fields.status === 1 && fields.nextAttemptAt === 1);
  assert.ok(claim, "expected a (status, nextAttemptAt) index for the queue claim");
});

test("the mobile number is uniquely indexed so one number is one account", () => {
  const guard = User.schema.indexes()
    .find(([fields]) => Object.keys(fields).length === 1 && fields.mobileNumber === 1);
  assert.ok(guard, "expected a mobileNumber index");
  assert.equal(guard[1].unique, true);
  // Partial for the same reason as workerCode: the default is null, and a
  // sparse index indexes null, so every user without a number would collide.
  assert.deepEqual(guard[1].partialFilterExpression, { mobileNumber: { $type: "string" } });
  assert.equal(guard[1].sparse, undefined);
});

test("user-facing links use one origin even when FRONTEND_URL lists several", () => {
  // FRONTEND_URL is a CORS allow-list and legitimately holds several origins
  // (app domain + custom domain). Building a link from the whole value produced
  // "https://a.com,https://b.com/work?record=1" in every WhatsApp assignment
  // message and every certificate verification URL.
  const { resolvePublicAppUrl } = require("../src/config/env");

  assert.equal(
    resolvePublicAppUrl("https://app.example.com,https://safety.example.com"),
    "https://app.example.com"
  );
  assert.equal(resolvePublicAppUrl("https://app.example.com"), "https://app.example.com");
  // Whitespace around the separator is normal in a hand-edited .env.
  assert.equal(
    resolvePublicAppUrl(" https://app.example.com , https://safety.example.com "),
    "https://app.example.com"
  );
  assert.equal(resolvePublicAppUrl(""), "http://localhost:3000");
  assert.equal(resolvePublicAppUrl(undefined), "http://localhost:3000");
  assert.ok(!resolvePublicAppUrl("https://a.com,https://b.com").includes(","));
});
