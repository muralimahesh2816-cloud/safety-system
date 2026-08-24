import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Printer, QrCode, RefreshCw, ScanLine, X } from "lucide-react";
import { modalEnter, overlayEnter } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import ActionButton from "../common/ActionButton";
import ModalPortal from "../common/ModalPortal";
import StatusBadge from "../common/StatusBadge";
import { ButtonSpinner } from "../common/Skeletons";
import { workerQrService } from "../../api/services";
import { showConfirmPopup, showSuccessPopup, showValidationPopup } from "../../utils/alerts";
import { ORGANIZATION_NAME, APP_NAME } from "../../config/appConfig";
import brandLogo from "../../assets/vertis-logo.svg";

/**
 * Full-size worker badge: preview, identity, and the download/print actions.
 *
 * The QR payload is issued and signed by the server; this only renders it.
 * `qrcode` is imported dynamically so the encoder is downloaded by someone who
 * actually opens a badge, not by everyone who loads the app.
 */
const QR_PIXEL_SIZE = 1024; // print-grade; displayed scaled down

const roleLabel = (role = "") => String(role || "").replace(/_/g, " ");

const WorkerQrModal = ({ open, user, canRegenerate = false, onClose }) => {
  const reduced = useReducedMotion();
  const canvasRef = useRef(null);
  const closeRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [busy, setBusy] = useState("");

  const userId = user?._id || user?.id;
  const isActive = (user?.status || "active") === "active";

  const load = useCallback(async () => {
    if (!userId) return;
    setState({ loading: true, error: "", data: null });
    try {
      const response = await workerQrService.get(userId);
      setState({ loading: false, error: "", data: response });
    } catch (error) {
      setState({
        loading: false,
        error: error?.response?.data?.message || "Unable to load this worker's QR badge.",
        data: null
      });
    }
  }, [userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Render whenever the payload arrives or the canvas remounts.
  useEffect(() => {
    const payload = state.data?.qrPayload;
    if (!payload || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      if (cancelled || !canvasRef.current) return;
      await QRCode.toCanvas(canvasRef.current, payload, {
        width: QR_PIXEL_SIZE,
        // Quiet zone. Below 4 modules many phone scanners fail to lock on.
        margin: 4,
        // Highest error correction, so a scuffed or partly obscured printed
        // badge still reads on site.
        errorCorrectionLevel: "H",
        color: { dark: "#101214", light: "#ffffff" }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [state.data]);

  const worker = state.data?.worker;
  const qrId = state.data?.workerQrId || "";

  const fileName = `${(ORGANIZATION_NAME.split(/[\s.]+/)[0] || "UTPL").toUpperCase()}_${(worker?.name || "worker")
    .replace(/[^a-z0-9]+/gi, "")}_${worker?.employeeId || "NOID"}_QR.png`;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = fileName;
    link.click();
  };

  const print = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=760,height=940");
    if (!printWindow) {
      showValidationPopup("Allow pop-ups for this site to print the worker badge.", "Print Blocked");
      return;
    }
    // Self-contained A4 badge sheet: the QR at a size that survives printing,
    // plus the human-readable identity a supervisor checks the badge against.
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName.replace(/\.png$/, "")}</title>
      <style>
        @page { size: A4 portrait; margin: 16mm; }
        * { box-sizing: border-box; }
        body { font-family: Inter, Arial, Helvetica, sans-serif; color: #101214; margin: 0; }
        .sheet { display: flex; align-items: center; justify-content: center; min-height: 240mm; }
        .badge { width: 96mm; border: 2px solid #101214; border-radius: 6mm; padding: 10mm 8mm; text-align: center; }
        .logo { height: 14mm; margin-bottom: 3mm; }
        .system { font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: #6b6560; margin: 0 0 6mm; }
        h1 { font-size: 16pt; margin: 0 0 1mm; }
        .role { font-size: 10pt; color: #55504b; text-transform: capitalize; margin: 0 0 5mm; }
        .qr { width: 62mm; height: 62mm; display: block; margin: 0 auto; }
        .eid { font-family: ui-monospace, "Courier New", monospace; font-size: 12pt; font-weight: 700; margin: 5mm 0 1mm; }
        .qrid { font-family: ui-monospace, "Courier New", monospace; font-size: 7.5pt; color: #7a746e; margin: 0 0 4mm; }
        .scan { font-size: 9pt; font-weight: 700; color: #9b1400; margin: 0 0 3mm; }
        .note { font-size: 7pt; color: #8a847e; line-height: 1.5; margin: 0; }
      </style></head><body>
      <div class="sheet"><div class="badge">
        <img class="logo" src="${brandLogo}" alt="" />
        <p class="system">${APP_NAME}</p>
        <h1>${worker?.name || ""}</h1>
        <p class="role">${roleLabel(worker?.role)}</p>
        <img class="qr" src="${image}" alt="" />
        <p class="eid">${worker?.employeeId || ""}</p>
        <p class="qrid">${qrId}</p>
        <p class="scan">Scan for Worker Attendance</p>
        <p class="note">${ORGANIZATION_NAME}<br/>If this badge is lost, report it immediately so it can be revoked.</p>
      </div></div>
      </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const regenerate = async () => {
    const confirmed = await showConfirmPopup({
      title: "Regenerate this worker QR badge?",
      text: "Every badge already printed for this worker stops working immediately. Use this if a badge has been lost or copied.",
      confirmText: "Regenerate",
      cancelText: "Cancel",
      icon: "warning"
    });
    if (!confirmed) return;

    setBusy("regenerate");
    try {
      const response = await workerQrService.regenerate(userId);
      setState((previous) => ({
        ...previous,
        data: {
          ...previous.data,
          qrPayload: response.qrPayload,
          workerQrId: response.workerQrId,
          issuedAt: response.issuedAt
        }
      }));
      await showSuccessPopup("Badge Regenerated", "Previously printed badges no longer work.");
    } catch (error) {
      showValidationPopup(
        error?.response?.data?.message || "Could not regenerate this badge.",
        "Unable to Regenerate"
      );
    } finally {
      setBusy("");
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <motion.div
        {...(reduced ? {} : overlayEnter)}
        className="hse-overlay hse-overlay--nested flex items-center justify-center bg-slate-950/88 p-3"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          {...(reduced ? {} : modalEnter)}
          role="dialog"
          aria-modal="true"
          aria-label={`Worker QR badge for ${user?.name || "worker"}`}
          className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/12 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,.65)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[var(--brand-accent-soft)]">
                <QrCode size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">Worker QR</h2>
                <p className="text-[11px] text-slate-400">Scan to record site attendance</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close worker QR"
              className="shrink-0 rounded-xl border border-white/15 bg-white/[0.07] p-2 text-slate-200 transition hover:bg-white/[0.14]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <div className="px-5 py-5">
            {state.loading ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-xs text-slate-400">
                <ButtonSpinner size={24} />
                <p>Generating badge...</p>
              </div>
            ) : state.error ? (
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-4 text-center">
                <p role="alert" className="text-xs text-rose-100">{state.error}</p>
                <ActionButton variant="secondary" size="sm" className="mt-3" icon={RefreshCw} onClick={load}>
                  Try Again
                </ActionButton>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-3.5">
                    <canvas
                      ref={canvasRef}
                      className="h-52 w-52"
                      role="img"
                      aria-label={`QR badge for ${worker?.name || "worker"}`}
                    />
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <p className="font-display text-lg font-semibold text-white">{worker?.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-slate-400">{roleLabel(worker?.role)}</p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                    <StatusBadge
                      status={isActive ? "Active" : "Inactive"}
                      tone={isActive ? "success" : "critical"}
                    />
                    {worker?.department ? <StatusBadge status={worker.department} tone="neutral" /> : null}
                  </div>
                </div>

                <dl className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Employee ID</dt>
                    <dd className="font-mono font-semibold text-slate-100">{worker?.employeeId || "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Worker QR ID</dt>
                    <dd className="truncate font-mono text-[11px] text-slate-300">{qrId || "—"}</dd>
                  </div>
                </dl>

                {!isActive ? (
                  <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-100">
                    This worker is inactive. Scanning this badge will be rejected and no attendance
                    will be recorded.
                  </p>
                ) : null}

                <p className="mt-3.5 flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                  <ScanLine size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Contains no personal data — only a random signed code the server verifies. It
                    cannot be used to sign in.
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Sticky footer: on a phone the badge is taller than the viewport,
              and the actions must stay reachable without scrolling to hunt for
              them. All three buttons share one size and `flex-1`, so they have
              a single height and width rather than three different ones. */}
          {!state.loading && !state.error ? (
            <footer className="sticky bottom-0 flex flex-wrap gap-2 border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-sm">
              <ActionButton className="min-w-[7rem] flex-1" icon={Download} onClick={download}>
                Download
              </ActionButton>
              <ActionButton variant="secondary" className="min-w-[7rem] flex-1" icon={Printer} onClick={print}>
                Print
              </ActionButton>
              {canRegenerate ? (
                <ActionButton
                  variant="danger"
                  className="min-w-[7rem] flex-1"
                  icon={RefreshCw}
                  loading={busy === "regenerate"}
                  loadingLabel="Regenerating..."
                  onClick={regenerate}
                >
                  Regenerate
                </ActionButton>
              ) : null}
            </footer>
          ) : null}
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
};

export default WorkerQrModal;
