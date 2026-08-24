// Stages during which worker attendance can be recorded.
//
// Mirrors ATTENDANCE_OPEN_STAGES in backend/src/constants/work-attendance.js.
// This copy exists only to decide whether to render the panel; the backend is
// what actually enforces the rule, and it re-checks the stage on every scan and
// every confirm. Keeping the two in sync matters for UX, not for correctness —
// if this drifts, the user sees a scan button that the server refuses, never an
// attendance record that should not exist.
export const ATTENDANCE_OPEN_STAGES = Object.freeze([
  "Approved",
  "Work In Progress",
  "Partially Completed"
]);

export const isAttendanceStage = (stage) => ATTENDANCE_OPEN_STAGES.includes(stage);
