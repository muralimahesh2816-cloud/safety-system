const { z } = require("zod");
const { ROLES } = require("../constants/roles");

const createTrainingSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(4),
  category: z.string().min(2),
  // Optional finer-grained sub-topic shown as "Training Concept" on
  // certificates, distinct from the broader category.
  concept: z.string().optional().default(""),
  durationMinutes: z.coerce.number().min(1).optional(),
  tags: z.string().optional(),
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
