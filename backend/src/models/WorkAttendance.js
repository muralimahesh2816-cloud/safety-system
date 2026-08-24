const mongoose = require("mongoose");

/**
 * A worker's recorded presence on a work approval.
 *
 * Why a separate collection rather than an array on WorkApproval: attendance
 * grows per worker per day, and embedding it would make every work-approval
 * list response carry the whole roster — the same mistake that made the
 * training list unbounded. A separate collection also lets attendance be
 * queried and reported on directly.
 *
 * Snapshots (`workerName`, `workerRole`, `employeeId`): deliberate duplication.
 * A safety attendance record is evidence of who was on site on a given day; if
 * an employee is later renamed, changes role or leaves, the historical record
 * must still read correctly. `worker` still references the live User for
 * anything that should follow the current record.
 *
 * `workSessionKey` scopes uniqueness. It is the calendar date by default, so a
 * worker is recorded once per work approval per day, and the model is already
 * shaped for named shifts or multi-stage work without a migration.
 */
const workAttendanceSchema = new mongoose.Schema(
  {
    workApproval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkApproval",
      required: true,
      index: true
    },
    // Defaults to the attendance date (YYYY-MM-DD). Kept as an opaque string so
    // a future shift identifier ("2026-08-24:night") needs no schema change.
    workSessionKey: { type: String, required: true },

    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: String, default: "" },
    workerName: { type: String, required: true },
    workerRole: { type: String, default: "" },

    attendanceAt: { type: Date, required: true, default: Date.now },

    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scannedByName: { type: String, default: "" },
    scannedByRole: { type: String, default: "" },

    status: {
      type: String,
      enum: ["present", "removed"],
      default: "present",
      index: true
    },

    // Where the scan happened, when the device supplied it and the user allowed
    // it. Optional by design — attendance must never depend on location being
    // available, and nothing here is required for the record to be valid.
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      formattedAddress: { type: String, default: "" }
    },

    // Which badge was used. Stored so a badge that is later rotated can still
    // be traced through historical attendance; it is a random code, not an
    // identifier that means anything on its own.
    workerCode: { type: String, default: "" },

    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removalReason: { type: String, default: "" }
  },
  { timestamps: true }
);

// The duplicate-attendance guard, enforced by the database rather than by a
// read-then-write check in the route: two scanners on site can hit the same
// worker at the same moment, and only a unique index actually prevents the
// race. Partial so a removed record does not block re-adding the worker.
workAttendanceSchema.index(
  { workApproval: 1, workSessionKey: 1, worker: 1 },
  { unique: true, partialFilterExpression: { status: "present" } }
);

// Roster reads for one work approval, newest first.
workAttendanceSchema.index({ workApproval: 1, status: 1, attendanceAt: -1 });
// Per-worker attendance history, for reporting.
workAttendanceSchema.index({ worker: 1, attendanceAt: -1 });
// Date-ranged attendance reports.
workAttendanceSchema.index({ attendanceAt: -1 });

module.exports = mongoose.model("WorkAttendance", workAttendanceSchema);
