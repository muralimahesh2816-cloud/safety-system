const { ROLES } = require("./roles");
const { WORK_STAGES } = require("./work-status");

/**
 * Roles permitted to record worker attendance.
 *
 * Attendance is safety evidence — it is what a post-incident investigation
 * reads to establish who was on site. So it is restricted to the site-present
 * supervisory roles that already carry approval-stage authority in this system,
 * plus administrators. A general employee can hold a badge and be scanned, but
 * cannot scan (and therefore cannot add themselves or anyone else).
 *
 * This deliberately reuses the existing ROLES constants rather than inventing a
 * parallel permission vocabulary.
 */
const ATTENDANCE_SCANNER_ROLES = Object.freeze([
  ROLES.SAFETY_OFFICER,
  ROLES.SAFETY_ENGINEER,
  ROLES.SITE_ENGINEER,
  ROLES.PROJECT_ENGINEER,
  ROLES.MAINTENANCE_ENGINEER,
  ROLES.CONSTRUCTION_MANAGER,
  ROLES.OPERATIONS_MANAGER,
  ROLES.SAFETY_MANAGER,
  ROLES.PROJECT_MANAGER,
  ROLES.MAINTENANCE_MANAGER,
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
]);

/**
 * Removing an attendance record rewrites safety evidence, so it is narrower
 * than recording one: only safety management and administrators.
 */
const ATTENDANCE_REMOVER_ROLES = Object.freeze([
  ROLES.SAFETY_MANAGER,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
]);

/**
 * Stages during which attendance may be recorded.
 *
 * Attendance describes people physically doing the work, so it opens once the
 * work is approved and closes when the record is completed. Recording presence
 * against work that has not been approved — or that is already closed out —
 * would be a data-integrity problem, not a convenience.
 */
const ATTENDANCE_OPEN_STAGES = Object.freeze([
  WORK_STAGES.APPROVED,
  WORK_STAGES.WORK_IN_PROGRESS,
  WORK_STAGES.PARTIALLY_COMPLETED
]);

const canScanAttendance = (role) => ATTENDANCE_SCANNER_ROLES.includes(role);
const canRemoveAttendance = (role) => ATTENDANCE_REMOVER_ROLES.includes(role);
const isAttendanceOpenStage = (stage) => ATTENDANCE_OPEN_STAGES.includes(stage);

/**
 * Session key for a given moment. Defaults to the calendar date, so a worker is
 * counted once per work approval per day; the shape allows a named shift later
 * without changing the schema or the unique index.
 */
const buildWorkSessionKey = (date = new Date(), shift = "") => {
  const iso = new Date(date).toISOString().slice(0, 10);
  return shift ? `${iso}:${shift}` : iso;
};

module.exports = {
  ATTENDANCE_SCANNER_ROLES,
  ATTENDANCE_REMOVER_ROLES,
  ATTENDANCE_OPEN_STAGES,
  buildWorkSessionKey,
  canRemoveAttendance,
  canScanAttendance,
  isAttendanceOpenStage
};
