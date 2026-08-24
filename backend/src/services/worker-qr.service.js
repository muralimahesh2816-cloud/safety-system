const crypto = require("crypto");
const { env } = require("../config/env");

// Worker QR identity.
//
// Threat model: a printed QR badge is a physical object that anyone can
// photograph, and the scanner runs in a browser we do not control. So the QR
// must be (a) useless if copied out of context and (b) impossible to forge.
//
// It therefore carries NO personal data, NO credentials and NO database id —
// only a random per-worker code plus an HMAC over it. Everything the scanner
// displays (name, employee id, role, photo) is looked up server-side from that
// code after the signature is verified, so a hand-crafted QR string cannot
// inject a worker identity, and a stolen QR image reveals nothing about its
// holder.
//
// Wire format:  UTPLHSE1:W:<workerCode>:<signature>
//                  |      |      |            |
//                  |      |      |            +-- HMAC-SHA256, base64url, truncated
//                  |      |      +--------------- 128-bit random, base32-ish
//                  |      +---------------------- payload kind (W = worker)
//                  +----------------------------- namespace + format version,
//                                                 so a future format can be
//                                                 told apart from this one
//                                                 rather than silently misread.

const QR_NAMESPACE = "UTPLHSE1";
const QR_KIND_WORKER = "W";
const SIGNATURE_LENGTH = 27; // 160 bits of the digest, base64url

// Derived from the JWT secret rather than adding another secret to configure.
// Domain-separated so a worker-QR signature can never be replayed as, or
// confused with, anything else signed with the same key material.
const getSigningKey = () =>
  crypto.createHmac("sha256", env.jwtAccessSecret).update("worker-qr-identity-v1").digest();

const sign = (workerCode) =>
  crypto
    .createHmac("sha256", getSigningKey())
    .update(`${QR_NAMESPACE}:${QR_KIND_WORKER}:${workerCode}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);

/** A fresh random worker code. Not derived from any user attribute. */
const generateWorkerCode = () => crypto.randomBytes(16).toString("base64url");

/** The full QR payload string for a stored worker code. */
const buildQrPayload = (workerCode) =>
  `${QR_NAMESPACE}:${QR_KIND_WORKER}:${workerCode}:${sign(workerCode)}`;

/**
 * Parses and verifies a scanned payload.
 *
 * Returns `{ valid: true, workerCode }` or `{ valid: false, reason }`. Never
 * throws — scanner input is untrusted and arrives in whatever shape the camera
 * happened to decode.
 */
const verifyQrPayload = (raw) => {
  if (typeof raw !== "string") return { valid: false, reason: "MALFORMED" };

  const value = raw.trim();
  if (!value) return { valid: false, reason: "MALFORMED" };
  // Bound the input before doing any work on it.
  if (value.length > 256) return { valid: false, reason: "MALFORMED" };

  const parts = value.split(":");
  if (parts.length !== 4) return { valid: false, reason: "MALFORMED" };

  const [namespace, kind, workerCode, signature] = parts;
  if (namespace !== QR_NAMESPACE) return { valid: false, reason: "UNKNOWN_FORMAT" };
  if (kind !== QR_KIND_WORKER) return { valid: false, reason: "UNKNOWN_FORMAT" };
  if (!workerCode || !/^[A-Za-z0-9_-]{8,64}$/.test(workerCode)) {
    return { valid: false, reason: "MALFORMED" };
  }

  const expected = sign(workerCode);
  // Constant-time compare so a signature cannot be discovered byte by byte.
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(signature || ""));
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { valid: false, reason: "SIGNATURE_INVALID" };
  }

  return { valid: true, workerCode };
};

module.exports = {
  QR_NAMESPACE,
  QR_KIND_WORKER,
  buildQrPayload,
  generateWorkerCode,
  verifyQrPayload
};
