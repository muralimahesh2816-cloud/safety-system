const { z } = require("zod");

// The raw string decoded from the camera. Bounded before it reaches the
// signature check — this is untrusted input from an image the scanner happened
// to resolve, and it may be arbitrary text from any QR code the user pointed at.
const qrPayload = z
  .string()
  .trim()
  .min(8, "A worker QR code is required")
  .max(256, "This QR code is not a worker badge");

// Optional capture location. Every field is nullable: attendance must never
// depend on the device providing a position or the user granting permission.
const locationSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    accuracy: z.coerce.number().min(0).nullable().optional(),
    formattedAddress: z.string().max(500).optional().default("")
  })
  .optional();

const attendanceScanSchema = z.object({
  qrPayload
});

const attendanceConfirmSchema = z.object({
  qrPayload,
  location: locationSchema
});

module.exports = {
  attendanceScanSchema,
  attendanceConfirmSchema
};
