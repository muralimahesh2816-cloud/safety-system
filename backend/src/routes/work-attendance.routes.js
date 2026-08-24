const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const User = require("../models/User");
const WorkApproval = require("../models/WorkApproval");
const WorkAttendance = require("../models/WorkAttendance");
const { normalizeWorkStage } = require("../constants/work-status");
const {
  buildWorkSessionKey,
  canRemoveAttendance,
  canScanAttendance,
  isAttendanceOpenStage
} = require("../constants/work-attendance");
const { verifyQrPayload } = require("../services/worker-qr.service");
const { attendanceScanSchema, attendanceConfirmSchema } = require("../validators/work-attendance.validators");

// Mounted at /work-approvals — `mergeParams` gives these handlers the :id of
// the parent work approval.
const router = express.Router({ mergeParams: true });

const toObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new ApiError(400, `Invalid ${label}`);
  return value;
};

/**
 * Shared gate for every attendance operation.
 *
 * Everything a client could lie about is re-derived here from the database:
 * the work approval, its current stage, and the scanner's role. The browser is
 * never trusted for any of it.
 */
const loadAttendanceContext = async (req, { requireOpenStage = true } = {}) => {
  const workId = toObjectId(req.params.id, "work approval id");

  if (!canScanAttendance(req.user.role)) {
    throw new ApiError(
      403,
      "Your role is not permitted to record worker attendance.",
      null,
      "ATTENDANCE_PERMISSION_REQUIRED"
    );
  }

  const work = await WorkApproval.findById(workId).select(
    "approvalNumber title workType location workflowStage status workersCount completedAt approvedAt"
  );
  if (!work) throw new ApiError(404, "Work approval not found");

  const stage = normalizeWorkStage(work);
  if (requireOpenStage && !isAttendanceOpenStage(stage)) {
    throw new ApiError(
      409,
      `Worker attendance can only be recorded once work is approved and before it is closed out. This work approval is currently "${stage}".`,
      null,
      "ATTENDANCE_STAGE_CLOSED"
    );
  }

  return { work, stage };
};

/** The shape the UI renders for one attendance row. */
const toAttendanceResponse = (record) => ({
  _id: record._id,
  workApproval: record.workApproval,
  workSessionKey: record.workSessionKey,
  worker: record.worker,
  employeeId: record.employeeId,
  workerName: record.workerName,
  workerRole: record.workerRole,
  attendanceAt: record.attendanceAt,
  scannedBy: record.scannedBy,
  scannedByName: record.scannedByName,
  scannedByRole: record.scannedByRole,
  status: record.status,
  location: record.location || null,
  createdAt: record.createdAt
});

const buildSummary = (work, presentCount) => {
  const assigned = Number(work.workersCount) || 0;
  return {
    workersAssigned: assigned,
    workersPresent: presentCount,
    attendancePercent: assigned > 0 ? Math.round((presentCount / assigned) * 100) : null
  };
};

/* ------------------------------------------------------------------ scan */

/**
 * Resolve a scanned badge to a worker — WITHOUT recording anything.
 *
 * Deliberately a read-only preview: the operator confirms the person in front
 * of them matches what the badge resolved to before any record exists. That is
 * also why a duplicate is reported here as a normal result rather than an
 * error — the UI needs to show "already present, at 10:32" and stop.
 */
router.post(
  "/scan",
  authMiddleware,
  authorizePermission("work", "view"),
  asyncHandler(async (req, res) => {
    const parsed = attendanceScanSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Validation failed", parsed.error.flatten());

    const { work } = await loadAttendanceContext(req);

    const verified = verifyQrPayload(parsed.data.qrPayload);
    if (!verified.valid) {
      throw new ApiError(
        400,
        "This QR code is not a valid worker badge for this portal.",
        null,
        `QR_${verified.reason}`
      );
    }

    // The badge carries only a random code; every displayed detail is looked up
    // here, after the signature check.
    const worker = await User.findOne({ workerCode: verified.workerCode }).select(
      "name email employeeId role status department plaza profilePhoto"
    );
    if (!worker) {
      throw new ApiError(404, "No worker is registered against this badge.", null, "QR_WORKER_NOT_FOUND");
    }
    if (worker.status !== "active") {
      throw new ApiError(
        403,
        `${worker.name} is not an active employee and cannot be marked present.`,
        null,
        "WORKER_INACTIVE"
      );
    }

    const workSessionKey = buildWorkSessionKey();
    const existing = await WorkAttendance.findOne({
      workApproval: work._id,
      workSessionKey,
      worker: worker._id,
      status: "present"
    });

    res.json({
      success: true,
      alreadyPresent: Boolean(existing),
      attendance: existing ? toAttendanceResponse(existing) : null,
      worker: {
        _id: worker._id,
        name: worker.name,
        employeeId: worker.employeeId,
        role: worker.role,
        department: worker.department,
        plaza: worker.plaza,
        profilePhoto: worker.profilePhoto || null
      },
      work: {
        _id: work._id,
        approvalNumber: work.approvalNumber,
        title: work.title,
        workType: work.workType,
        location: work.location
      },
      workSessionKey,
      scannedAt: new Date()
    });
  })
);

/* --------------------------------------------------------------- confirm */

/**
 * Record the attendance the operator just confirmed.
 *
 * Re-validates everything the scan step validated. The scan response is not
 * carried forward as proof of anything: a client could call this endpoint
 * directly, so the badge is verified and the worker re-resolved here too.
 */
router.post(
  "/",
  authMiddleware,
  authorizePermission("work", "update"),
  asyncHandler(async (req, res) => {
    const parsed = attendanceConfirmSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Validation failed", parsed.error.flatten());

    const { work } = await loadAttendanceContext(req);

    const verified = verifyQrPayload(parsed.data.qrPayload);
    if (!verified.valid) {
      throw new ApiError(
        400,
        "This QR code is not a valid worker badge for this portal.",
        null,
        `QR_${verified.reason}`
      );
    }

    const worker = await User.findOne({ workerCode: verified.workerCode }).select(
      "name employeeId role status"
    );
    if (!worker) {
      throw new ApiError(404, "No worker is registered against this badge.", null, "QR_WORKER_NOT_FOUND");
    }
    if (worker.status !== "active") {
      throw new ApiError(403, `${worker.name} is not an active employee.`, null, "WORKER_INACTIVE");
    }

    const workSessionKey = buildWorkSessionKey();
    const location = parsed.data.location || {};

    try {
      const attendance = await WorkAttendance.create({
        workApproval: work._id,
        workSessionKey,
        worker: worker._id,
        employeeId: worker.employeeId || "",
        // Snapshots, so this record still reads correctly if the employee is
        // later renamed, reassigned or offboarded.
        workerName: worker.name,
        workerRole: worker.role,
        attendanceAt: new Date(),
        scannedBy: req.user.id,
        scannedByName: req.user.name || "",
        scannedByRole: req.user.role || "",
        status: "present",
        workerCode: verified.workerCode,
        location: {
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
          accuracy: location.accuracy ?? null,
          formattedAddress: location.formattedAddress || ""
        }
      });

      await audit(
        req,
        "attendance_recorded",
        "work",
        {
          approvalNumber: work.approvalNumber,
          workerName: worker.name,
          employeeId: worker.employeeId,
          workerRole: worker.role,
          workSessionKey
        },
        work._id
      );

      const presentCount = await WorkAttendance.countDocuments({
        workApproval: work._id,
        workSessionKey,
        status: "present"
      });

      res.status(201).json({
        success: true,
        attendance: toAttendanceResponse(attendance),
        summary: buildSummary(work, presentCount)
      });
    } catch (error) {
      // The unique index is the real duplicate guard — two scanners hitting the
      // same worker at the same instant both pass a read check, and only one
      // can win the write.
      if (error?.code === 11000) {
        const existing = await WorkAttendance.findOne({
          workApproval: work._id,
          workSessionKey,
          worker: worker._id,
          status: "present"
        });

        await audit(
          req,
          "attendance_duplicate_blocked",
          "work",
          { approvalNumber: work.approvalNumber, workerName: worker.name, workSessionKey },
          work._id
        );

        throw new ApiError(
          409,
          `${worker.name} is already marked present for this work today.`,
          existing ? { attendance: toAttendanceResponse(existing) } : null,
          "ATTENDANCE_DUPLICATE"
        );
      }
      throw error;
    }
  })
);

/* ------------------------------------------------------------------ list */

router.get(
  "/",
  authMiddleware,
  authorizePermission("work", "view"),
  asyncHandler(async (req, res) => {
    const workId = toObjectId(req.params.id, "work approval id");
    const work = await WorkApproval.findById(workId).select("workersCount approvalNumber");
    if (!work) throw new ApiError(404, "Work approval not found");

    // Defaults to today's session; `?session=all` returns the full history.
    const sessionFilter =
      req.query.session === "all"
        ? {}
        : { workSessionKey: req.query.session || buildWorkSessionKey() };

    const records = await WorkAttendance.find({
      workApproval: workId,
      status: "present",
      ...sessionFilter
    })
      .sort({ attendanceAt: 1 })
      .lean();

    res.json({
      success: true,
      records: records.map(toAttendanceResponse),
      summary: buildSummary(work, records.length),
      workSessionKey: sessionFilter.workSessionKey || null,
      canScan: canScanAttendance(req.user.role),
      canRemove: canRemoveAttendance(req.user.role)
    });
  })
);

/* ---------------------------------------------------------------- remove */

/**
 * Soft-removes an attendance record.
 *
 * Never a hard delete: attendance is safety evidence, so a correction must
 * leave a trace. The record is marked `removed` (which also releases the
 * partial unique index so the worker can be re-added) and audited with the
 * reason.
 */
router.delete(
  "/:attendanceId",
  authMiddleware,
  authorizePermission("work", "update"),
  asyncHandler(async (req, res) => {
    const workId = toObjectId(req.params.id, "work approval id");
    const attendanceId = toObjectId(req.params.attendanceId, "attendance id");

    if (!canRemoveAttendance(req.user.role)) {
      throw new ApiError(
        403,
        "Only a Safety Manager or an administrator can remove a worker attendance record.",
        null,
        "ATTENDANCE_REMOVE_PERMISSION_REQUIRED"
      );
    }

    const attendance = await WorkAttendance.findOne({
      _id: attendanceId,
      workApproval: workId,
      status: "present"
    });
    if (!attendance) throw new ApiError(404, "Attendance record not found");

    attendance.status = "removed";
    attendance.removedAt = new Date();
    attendance.removedBy = req.user.id;
    attendance.removalReason = String(req.body?.reason || "").slice(0, 500);
    await attendance.save();

    await audit(
      req,
      "attendance_removed",
      "work",
      {
        workerName: attendance.workerName,
        employeeId: attendance.employeeId,
        workSessionKey: attendance.workSessionKey,
        reason: attendance.removalReason
      },
      workId
    );

    const work = await WorkApproval.findById(workId).select("workersCount");
    const presentCount = await WorkAttendance.countDocuments({
      workApproval: workId,
      workSessionKey: attendance.workSessionKey,
      status: "present"
    });

    res.json({
      success: true,
      message: "Attendance record removed",
      summary: buildSummary(work || {}, presentCount)
    });
  })
);

module.exports = router;
