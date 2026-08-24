import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer, QrCode, RefreshCw } from "lucide-react";
import ActionButton from "../common/ActionButton";
import { ButtonSpinner } from "../common/Skeletons";
import { workerQrService } from "../../api/services";
import { showConfirmPopup, showSuccessPopup, showValidationPopup } from "../../utils/alerts";
import { ORGANIZATION_NAME } from "../../config/appConfig";

/**
 * A worker's printable QR badge.
 *
 * The QR payload is issued by the server and only rendered here — the client
 * never constructs or signs one, because a signature the client could produce
 * would be worthless.
 *
 * `qrcode` is imported dynamically: it is only needed by someone actually
 * looking at a badge, so it stays out of the main bundle.
 */
const QR_PIXEL_SIZE = 640;

const WorkerQrCard = ({ userId, canRegenerate = false, className = "" }) => {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [busy, setBusy] = useState("");

  const render = useCallback(async (payload) => {
    if (!payload || !canvasRef.current) return;
    const QRCode = (await import("qrcode")).default;
    await QRCode.toCanvas(canvasRef.current, payload, {
      width: QR_PIXEL_SIZE,
      margin: 2,
      // High error correction so a scuffed or partly obscured printed badge
      // still reads on site.
      errorCorrectionLevel: "H",
      color: { dark: "#101214", light: "#ffffff" }
    });
  }, []);

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
    load();
  }, [load]);

  useEffect(() => {
    if (state.data?.qrPayload) render(state.data.qrPayload);
  }, [state.data, render]);

  const worker = state.data?.worker;
  const fileStem = `worker-qr-${(worker?.employeeId || worker?.name || "badge")
    .toString()
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}`;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${fileStem}.png`;
    link.click();
  };

  const print = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!printWindow) {
      showValidationPopup("Allow pop-ups for this site to print the worker badge.", "Print Blocked");
      return;
    }
    // A self-contained badge sheet: the QR plus the human-readable identity a
    // supervisor needs to check the badge against the person holding it.
    printWindow.document.write(`<!doctype html><html><head><title>Worker Badge — ${worker?.name || ""}</title>
      <style>
        @page { size: A4 portrait; margin: 18mm; }
        body { font-family: Inter, Arial, sans-serif; color: #101214; text-align: center; }
        .badge { border: 2px solid #101214; border-radius: 14px; padding: 26px; max-width: 420px; margin: 0 auto; }
        .org { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #6b6560; }
        h1 { font-size: 22px; margin: 6px 0 2px; }
        .role { font-size: 13px; color: #55504b; text-transform: capitalize; margin: 0 0 16px; }
        img { width: 260px; height: 260px; }
        .id { font-family: ui-monospace, monospace; font-size: 15px; font-weight: 700; margin-top: 14px; }
        .note { font-size: 10px; color: #7a746e; margin-top: 12px; line-height: 1.5; }
      </style></head><body>
      <div class="badge">
        <p class="org">${ORGANIZATION_NAME}</p>
        <h1>${worker?.name || ""}</h1>
        <p class="role">${String(worker?.role || "").replace(/_/g, " ")}</p>
        <img src="${image}" alt="" />
        <p class="id">${worker?.employeeId || ""}</p>
        <p class="note">Present this badge to a Safety Officer to record site attendance.<br/>If lost, report it immediately so the badge can be revoked.</p>
      </div>
      </body></html>`);
    printWindow.document.close();
    // Printing is triggered from this window rather than an inline <script> in
    // the generated document: the inline tag needs an escaped closing tag that
    // lint rejects, and waiting for load here is more reliable anyway.
    printWindow.onload = () => printWindow.print();
  };

  const regenerate = async () => {
    const confirmed = await showConfirmPopup({
      title: "Regenerate this worker QR badge?",
      text: "Every badge already printed for this worker will stop working immediately. Use this if a badge has been lost or copied.",
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
        data: { ...previous.data, qrPayload: response.qrPayload, issuedAt: response.issuedAt }
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

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      <header className="mb-4 flex items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[var(--brand-accent-soft)]">
          <QrCode size={17} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-white">Worker QR</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Scanned by a Safety Officer to record site attendance
          </p>
        </div>
      </header>

      {state.loading ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-xs text-slate-400">
          <ButtonSpinner size={22} />
          <p>Loading worker badge...</p>
        </div>
      ) : state.error ? (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-center">
          <p role="alert" className="text-[11px] text-rose-100">{state.error}</p>
          <ActionButton variant="secondary" size="sm" className="mt-3" icon={RefreshCw} onClick={load}>
            Try Again
          </ActionButton>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-3">
              {/* The canvas is the printable/downloadable artefact. */}
              <canvas
                ref={canvasRef}
                className="h-40 w-40"
                role="img"
                aria-label={`Worker QR badge for ${worker?.name || "this worker"}`}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{worker?.name}</p>
            <p className="text-[11px] capitalize text-slate-400">
              {worker?.employeeId ? `${worker.employeeId} · ` : ""}
              {String(worker?.role || "").replace(/_/g, " ")}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ActionButton variant="secondary" size="sm" icon={Download} onClick={download}>
              Download
            </ActionButton>
            <ActionButton variant="secondary" size="sm" icon={Printer} onClick={print}>
              Print
            </ActionButton>
            {canRegenerate ? (
              <ActionButton
                variant="danger"
                size="sm"
                icon={RefreshCw}
                loading={busy === "regenerate"}
                loadingLabel="Regenerating..."
                onClick={regenerate}
              >
                Regenerate
              </ActionButton>
            ) : null}
          </div>

          <p className="mt-3.5 text-center text-[10px] leading-relaxed text-slate-500">
            This badge contains no personal data — only a random code the server verifies. It cannot
            be used to sign in.
          </p>
        </>
      )}
    </section>
  );
};

export default WorkerQrCard;
