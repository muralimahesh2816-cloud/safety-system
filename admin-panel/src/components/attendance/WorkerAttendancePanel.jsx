import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ScanLine, Trash2, UserRound, UsersRound } from "lucide-react";
import ActionButton from "../common/ActionButton";
import EmptyState from "../common/EmptyState";
import StatusBadge from "../common/StatusBadge";
import { ListSkeleton } from "../common/Skeletons";
import QrScannerModal from "./QrScannerModal";
import AttendanceConfirmModal from "./AttendanceConfirmModal";
import { attendanceService } from "../../api/services";
import { showConfirmPopup, showSuccessPopup, showValidationPopup } from "../../utils/alerts";
import { formatDateTime } from "../../utils/format";

/**
 * Worker attendance for one work approval.
 *
 * Flow: Scan Worker QR -> camera -> badge decoded -> server resolves the worker
 * (read-only) -> operator confirms -> server records it. Nothing is written
 * until the confirm step, and every server response is authoritative — the
 * roster, the counts and the permission flags all come from the API rather than
 * being inferred here.
 */
const roleLabel = (role = "") => String(role || "").replace(/_/g, " ");

const WorkerAttendancePanel = ({ work, onSummaryChange }) => {
  const workId = work?._id || work?.id;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ workersAssigned: 0, workersPresent: 0, attendancePercent: null });
  const [permissions, setPermissions] = useState({ canScan: false, canRemove: false });
  const [error, setError] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState("");

  // Prevents a second submit between the click and React committing `submitting`.
  const confirmLockRef = useRef(false);

  const applySummary = useCallback(
    (next) => {
      setSummary(next);
      onSummaryChange?.(next);
    },
    [onSummaryChange]
  );

  const loadAttendance = useCallback(async () => {
    if (!workId) return;
    setLoading(true);
    setError("");
    try {
      const response = await attendanceService.list(workId);
      setRecords(response.records || []);
      applySummary(response.summary || { workersAssigned: 0, workersPresent: 0, attendancePercent: null });
      setPermissions({ canScan: Boolean(response.canScan), canRemove: Boolean(response.canRemove) });
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Unable to load worker attendance.");
    } finally {
      setLoading(false);
    }
  }, [workId, applySummary]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  /** Badge decoded — resolve it server-side, but record nothing yet. */
  const handleDecode = useCallback(
    async (qrPayload) => {
      if (scanning) return;
      setScanning(true);
      try {
        const response = await attendanceService.scan(workId, qrPayload);
        setScanResult({ ...response, qrPayload });
        setScannerOpen(false);
      } catch (scanError) {
        const message =
          scanError?.response?.data?.message || "This QR code could not be read as a worker badge.";
        showValidationPopup(message, "Badge Not Accepted");
      } finally {
        setScanning(false);
      }
    },
    [workId, scanning]
  );

  const confirmAttendance = async () => {
    if (!scanResult || confirmLockRef.current) return;
    confirmLockRef.current = true;
    setSubmitting(true);
    try {
      const response = await attendanceService.confirm(workId, { qrPayload: scanResult.qrPayload });
      setRecords((previous) => [...previous, response.attendance]);
      applySummary(response.summary);
      setScanResult(null);
      await showSuccessPopup(
        "Attendance Recorded",
        `${response.attendance.workerName} marked present.`
      );
    } catch (confirmError) {
      const data = confirmError?.response?.data;
      if (data?.code === "ATTENDANCE_DUPLICATE") {
        // Someone else recorded this worker between the scan and the confirm.
        await loadAttendance();
        setScanResult(null);
        showValidationPopup(data.message, "Already Present");
      } else {
        showValidationPopup(
          data?.message || "Attendance could not be recorded. Please try again.",
          "Unable to Record Attendance"
        );
      }
    } finally {
      confirmLockRef.current = false;
      setSubmitting(false);
    }
  };

  const removeAttendance = async (record) => {
    const confirmed = await showConfirmPopup({
      title: "Remove attendance record?",
      text: `${record.workerName} will no longer be counted as present for this work. This is recorded in the audit log.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      icon: "warning"
    });
    if (!confirmed) return;

    setRemovingId(record._id);
    try {
      const response = await attendanceService.remove(workId, record._id);
      setRecords((previous) => previous.filter((item) => item._id !== record._id));
      applySummary(response.summary);
      await showSuccessPopup("Attendance Removed");
    } catch (removeError) {
      showValidationPopup(
        removeError?.response?.data?.message || "Could not remove this attendance record.",
        "Unable to Remove"
      );
    } finally {
      setRemovingId("");
    }
  };

  const percentLabel = useMemo(() => {
    if (summary.attendancePercent === null || summary.attendancePercent === undefined) return "—";
    return `${summary.attendancePercent}%`;
  }, [summary.attendancePercent]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[var(--brand-accent-soft)]">
            <UsersRound size={17} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Worker Attendance</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Scan each worker&rsquo;s QR badge to record who is on site today
            </p>
          </div>
        </div>

        {permissions.canScan ? (
          <ActionButton icon={ScanLine} size="sm" onClick={() => setScannerOpen(true)}>
            Scan Worker QR
          </ActionButton>
        ) : null}
      </header>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[
          ["Assigned", summary.workersAssigned || 0],
          ["Present", summary.workersPresent || 0],
          ["Attendance", percentLabel]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center">
            <p className="font-display text-xl font-semibold leading-none text-white">{value}</p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No workers recorded yet"
          message={
            permissions.canScan
              ? "Scan a worker's QR badge to mark them present for today."
              : "No worker attendance has been recorded for this work today."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-white/[0.05] text-[10px] uppercase tracking-[0.1em] text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Worker</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Employee ID</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Role</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Time</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Scanned By</th>
                  {permissions.canRemove ? <th scope="col" className="px-3 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="border-t border-white/[0.07] transition hover:bg-white/[0.04]">
                    <td className="px-3 py-2.5 font-medium text-white">{record.workerName}</td>
                    <td className="px-3 py-2.5 text-slate-300">{record.employeeId || "—"}</td>
                    <td className="px-3 py-2.5 capitalize text-slate-300">{roleLabel(record.workerRole)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">{formatDateTime(record.attendanceAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status="Present" tone="success" /></td>
                    <td className="px-3 py-2.5 text-slate-400">{record.scannedByName || "—"}</td>
                    {permissions.canRemove ? (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeAttendance(record)}
                          disabled={removingId === record._id}
                          aria-label={`Remove ${record.workerName} from attendance`}
                          className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-1.5 text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {records.map((record) => (
              <li key={record._id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{record.workerName}</p>
                    <p className="mt-0.5 text-[11px] capitalize text-slate-400">
                      {record.employeeId || "—"} · {roleLabel(record.workerRole)}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-300">
                      <Clock3 size={11} aria-hidden="true" /> {formatDateTime(record.attendanceAt)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Scanned by {record.scannedByName || "—"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status="Present" tone="success" />
                    {permissions.canRemove ? (
                      <button
                        type="button"
                        onClick={() => removeAttendance(record)}
                        disabled={removingId === record._id}
                        aria-label={`Remove ${record.workerName} from attendance`}
                        className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-1.5 text-rose-200 disabled:opacity-50"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <QrScannerModal
        open={scannerOpen}
        busy={scanning}
        statusMessage="Verifying badge..."
        onClose={() => setScannerOpen(false)}
        onDecode={handleDecode}
      />

      <AttendanceConfirmModal
        open={Boolean(scanResult)}
        scan={scanResult}
        work={work}
        submitting={submitting}
        onCancel={() => setScanResult(null)}
        onConfirm={confirmAttendance}
      />
    </section>
  );
};

export default WorkerAttendancePanel;
