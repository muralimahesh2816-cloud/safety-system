const { z } = require("zod");
const { ROLES } = require("../constants/roles");

// Accepts either a real array (JSON body) or a JSON-encoded array string
// (multipart upload), and always yields a clean array of trimmed strings.
const stringListField = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .default([])
  .transform((value, ctx) => {
    let list = value;
    if (typeof value === "string") {
      if (!value.trim()) return [];
      try {
        list = JSON.parse(value);
      } catch (_error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a JSON array of strings" });
        return z.NEVER;
      }
    }
    if (!Array.isArray(list)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected an array of strings" });
      return z.NEVER;
    }
    return list
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 40);
  });

const createTrainingSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(4),
  category: z.string().min(2),
  // Optional finer-grained sub-topic shown as "Training Concept" on
  // certificates, distinct from the broader category.
  concept: z.string().optional().default(""),
  durationMinutes: z.coerce.number().min(1).optional(),
  tags: z.string().optional(),
  // Structured HSE teaching content. The list fields arrive from multipart
  // form data as JSON strings, so they are parsed and normalised here rather
  // than in the route: anything that is not an array of non-empty strings is
  // rejected instead of being silently stored as a malformed value.
  catalogId: z.string().max(120).optional().default(""),
  visualKey: z.string().max(60).optional().default(""),
  objective: z.string().max(2000).optional().default(""),
  hazards: stringListField,
  correctPractice: stringListField,
  incorrectPractice: stringListField,
  requiredPpe: stringListField,
  recommendedForRoles: z.array(z.nativeEnum(ROLES)).optional().default([]),
  // Instructor of record. trainerName is a free-text fallback for trainers
  // without a user account; trainer (a User id) is optional and validated
  // against the User collection in the route handler, not here.
  trainer: z.string().optional(),
  trainerName: z.string().optional().default(""),
  // If provided, a completion's assessmentScore must meet this to be
  // certificate-eligible (see certificate.service.js).
  passingScore: z.coerce.number().min(0).max(100).optional(),
  validityMonths: z.coerce.number().min(1).optional()
});

const progressSchema = z.object({
  progress: z.coerce.number().min(0).max(100),
  seconds: z.coerce.number().min(0).optional().default(0)
});

const assessmentScoreSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  score: z.coerce.number().min(0).max(100)
});

module.exports = {
  createTrainingSchema,
  progressSchema,
  assessmentScoreSchema
};
