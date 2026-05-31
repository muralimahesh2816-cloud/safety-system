const { z } = require("zod");
const { ROLES } = require("../constants/roles");

const createTrainingSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(4),
  category: z.string().min(2),
  durationMinutes: z.coerce.number().min(1).optional(),
  tags: z.string().optional(),
  recommendedForRoles: z.array(z.nativeEnum(ROLES)).optional().default([])
});

const progressSchema = z.object({
  progress: z.coerce.number().min(0).max(100),
  seconds: z.coerce.number().min(0).optional().default(0)
});

module.exports = {
  createTrainingSchema,
  progressSchema
};
