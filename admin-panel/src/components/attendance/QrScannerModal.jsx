import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Camera, CameraOff, RefreshCw, ScanLine, X } from "lucide-react";
import { modalEnter, overlayEnter } from "../../animation/motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import ActionButton from "../common/ActionButton";
import { ButtonSpinner } from "../common/Skeletons";

/**
 * Worker QR scanner.
 *
 * Camera handling notes, because they are the whole difficulty here:
 *
 *  - **Permission is requested only when this modal mounts**, and the modal
 *    only mounts on an explicit "Scan Worker QR" click. Nothing on the Work
 *    Approval page touches `getUserMedia` before that, so simply opening a work
 *    record never prompts for the camera.
 *  - **The stream is torn down on every exit path** — close, unmount, error,
 *    successful decode. A live `MediaStreamTrack` that outlives the modal keeps
 *    the camera indicator lit and holds the device against other apps.
 *  - Decoding runs off `requestAnimationFrame` against a throttled interval
 *    rather than every frame; scanning at 60fps on a full-resolution video
 *    frame is pure heat with no improvement in read rate.
 *  - `jsqr` is loaded dynamically so the decoder is only downloaded by someone
 *    who actually scans.
 */
const SCAN_INTERVAL_MS = 160;
const MAX_SCAN_DIMENSION = 640;

const PERMISSION_MESSAGES = {
  NotAllowedError: "Camera access is required to scan worker QR codes. Allow camera access in your browser and try again.",
  NotFoundError: "No camera was found on this device.",
  NotReadableError: "The camera is already in use by another application. Close it and try again.",
  OverconstrainedError: "No suitable camera could be selected on this device.",
  SecurityError: "The camera can only be used over a secure (HTTPS) connection."
};

const QrScannerModal = ({ open, onClose, onDecode, busy = false, statusMessage = "" }) => {
  const reduced = useReducedMotion();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanRef = useRef(0);
  // Guards against the decode loop firing a second time between a successful
  // read and the parent closing the modal.
  const decodedRef = useRef(false);

  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    setStatus("starting");
    decodedRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("This browser does not support camera access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Rear camera on a phone, any camera on a laptop.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setStatus("scanning");
    } catch (cameraError) {
      setStatus("error");
      setError(
        PERMISSION_MESSAGES[cameraError?.name] ||
          "Camera access is required to scan worker QR codes."
      );
    }
  }, []);

  // Mount = the user already clicked "Scan Worker QR".
  useEffect(() => {
    if (!open) return undefined;
    startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  // Decode loop.
  useEffect(() => {
    if (!open || status !== "scanning") return undefined;
    let cancelled = false;
    let jsQR = null;

    const tick = async (now) => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);

      if (busy || decodedRef.current) return;
      if (now - lastScanRef.current < SCAN_INTERVAL_MS) return;
      lastScanRef.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      if (!jsQR) {
        const module = await import("jsqr");
        if (cancelled) return;
        jsQR = module.default || module;
      }

      // Downscale before decoding: a 720p frame costs several times more to
      // scan than a 640px one and reads no better at badge distance.
      const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const result = jsQR(imageData.data, width, height, { inversionAttempts: "dontInvert" });

      if (result?.data && !decodedRef.current) {
        decodedRef.current = true;
        onDecode(result.data.trim());
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, status, busy, onDecode]);

  // Re-arm after the parent handled a scan that did not close the modal (a
  // duplicate, say), so the operator can immediately scan the next worker.
  useEffect(() => {
    if (!busy) decodedRef.current = false;
  }, [busy]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <motion.div
      {...(reduced ? {} : overlayEnter)}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        {...(reduced ? {} : modalEnter)}
        role="dialog"
        aria-modal="true"
        aria-label="Scan worker QR code"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,.65)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[var(--brand-accent-soft)]">
              <ScanLine size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Scan Worker QR</h2>
              <p className="text-[11px] text-slate-400">Place the badge inside the frame</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="rounded-xl border border-white/15 bg-white/[0.07] p-2 text-slate-200 transition hover:bg-white/[0.14]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="relative aspect-square w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
            aria-label="Camera preview"
          />
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {status === "scanning" ? (
            <>
              {/* Reticle */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="qr-reticle relative h-3/5 w-3/5">
                  <span className="qr-reticle__corner qr-reticle__corner--tl" />
                  <span className="qr-reticle__corner qr-reticle__corner--tr" />
                  <span className="qr-reticle__corner qr-reticle__corner--bl" />
                  <span className="qr-reticle__corner qr-reticle__corner--br" />
                  {!reduced && !busy ? <span className="qr-reticle__sweep" /> : null}
                </div>
              </div>
              <p className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-2.5 text-center text-xs text-slate-200">
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <ButtonSpinner size={12} /> {statusMessage || "Scanning worker..."}
                  </span>
                ) : (
                  "Scanning..."
                )}
              </p>
            </>
          ) : null}

          {status === "starting" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
              <Camera size={30} aria-hidden="true" />
              <p className="text-xs">Starting camera...</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/15 text-rose-200">
                <CameraOff size={22} aria-hidden="true" />
              </span>
              <p className="text-xs leading-relaxed text-slate-200" role="alert">
                {error}
              </p>
              <ActionButton size="sm" icon={RefreshCw} onClick={startCamera}>
                Try Again
              </ActionButton>
            </div>
          ) : null}
        </div>

        <footer className="flex items-start gap-2 border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-slate-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            The badge is verified on the server. Worker details are looked up there, never read
            from the QR image itself.
          </span>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default QrScannerModal;
