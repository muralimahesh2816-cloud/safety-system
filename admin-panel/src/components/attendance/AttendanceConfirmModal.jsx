import { motion } from "framer-motion";
import { CheckCircle2, Clock3, IdCard, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { modalEnter, overlayEnter } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import ActionButton from "../common/ActionButton";
import StatusBadge from "../common/StatusBadge";
import { formatDateTime } from "../../utils/format";
import { getMediaUrl } from "../../utils/media";

/**
 * The confirmation step between a successful badge read and an attendance
 * record existing.
 *
 * This deliberately sits in the way. A QR read is not proof that the person
 * holding the badge is the person in front of the operator — badges get lent,
 * dropped and photographed. Attendance is safety evidence, so the operator
 * looks at the resolved identity (and photo, when there is one) and takes
 * responsibility for it before anything is written.
 *
 * `alreadyPresent` is a normal outcome, not an error: the same worker being
 * scanned twice in a shift is routine, and the right answer is to show when
 * they were recorded and offer nothing but Close.
 */
const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <Icon size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-xs font-medium text-slate-100">{value || "—"}</p>
    </div>
  </div>
);

const AttendanceConfirmModal = ({
  open,
  scan,
  work,
  onCancel,
  onConfirm,
  submitting = false,
  locationLabel = ""
}) => {
  const reduced = useReducedMotion();
  if (!open || !scan) return null;

  const { worker, alreadyPresent, attendance, scannedAt } = scan;
  const photo = getMediaUrl(worker?.profilePhoto?.url || worker?.profilePhoto);
  const initials =
    String(worker?.name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?";

  return (
    <motion.div
      {...(reduced ? {} : overlayEnter)}
      className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/90 p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.div
        {...(reduced ? {} : modalEnter)}
        role="alertdialog"
        aria-modal="true"
        aria-label={alreadyPresent ? "Worker already present" : "Confirm worker attendance"}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,.65)]"
      >
        <header
          className={`flex items-center gap-3 border-b px-5 py-4 ${
            alreadyPresent
              ? "border-amber-400/25 bg-amber-500/[0.08]"
              : "border-emerald-400/25 bg-emerald-500/[0.08]"
          }`}
        >
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              alreadyPresent
                ? "border-amber-400/35 bg-amber-500/15 text-amber-200"
                : "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
            }`}
          >
            {alreadyPresent ? <Clock3 size={19} aria-hidden="true" /> : <ShieldCheck size={19} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">
              {alreadyPresent ? "Worker Already Present" : "Confirm Worker Attendance"}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-300">
              {alreadyPresent
                ? `Recorded at ${formatDateTime(attendance?.attendanceAt)}`
                : "Check this matches the person in front of you"}
            </p>
          </div>
        </header>

        <div className="px-5 py-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] text-lg font-semibold text-slate-200">
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-white">{worker?.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={worker?.role || "Employee"}
                  label={String(worker?.role || "employee").replace(/_/g, " ")}
                  tone="info"
                />
                {alreadyPresent ? <StatusBadge status="Present" tone="success" /> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <Row icon={IdCard} label="Employee ID" value={worker?.employeeId} />
            <Row icon={UserRound} label="Department" value={worker?.department || worker?.plaza} />
            <Row icon={ShieldCheck} label="Work Approval" value={work?.approvalNumber || work?.title} />
            <Row icon={Clock3} label="Time" value={formatDateTime(attendance?.attendanceAt || scannedAt)} />
            {locationLabel ? (
              <div className="col-span-2">
                <Row icon={MapPin} label="Scan location" value={locationLabel} />
              </div>
            ) : null}
          </div>

          {alreadyPresent ? (
            <p className="mt-3.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
              This worker is already marked present for this work today. No duplicate record has been
              created.
            </p>
          ) : null}
        </div>

        <footer className="flex gap-2.5 border-t border-white/10 px-5 py-4">
          <ActionButton variant="secondary" className="flex-1" onClick={onCancel} disabled={submitting}>
            {alreadyPresent ? "Close" : "Cancel"}
          </ActionButton>
          {!alreadyPresent ? (
            <ActionButton
              className="flex-1"
              icon={CheckCircle2}
              loading={submitting}
              loadingLabel="Recording..."
              onClick={onConfirm}
            >
              Confirm Attendance
            </ActionButton>
          ) : null}
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default AttendanceConfirmModal;
