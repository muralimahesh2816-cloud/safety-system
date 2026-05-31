const { z } = require("zod");

const createHazardSchema = z.object({
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().min(2),
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional().default("Medium"),
  likelihood: z
    .enum(["Rare", "Possible", "Likely", "Almost Certain"])
    .optional()
    .default("Possible"),
  riskScore: z.coerce.number().min(0).max(25).optional().default(0),
  date: z.string().optional(),
  plaza: z.string().optional().default(""),
  location: z.string().min(2),
  action: z.string().optional().default(""),
  reportedBy: z.string().optional().default(""),
  assignedTo: z.string().optional()
});

const assignHazardSchema = z.object({
  assignedTo: z.string().min(1)
});

const correctiveActionSchema = z.object({
  action: z.string().min(2),
  owner: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.enum(["Open", "In Progress", "Completed"]).optional().default("Open")
});

const closeHazardSchema = z.object({
  closureNotes: z.string().optional().default(""),
  status: z.enum(["Closed"]).optional().default("Closed")
});

module.exports = {
  createHazardSchema,
  assignHazardSchema,
  correctiveActionSchema,
  closeHazardSchema
};
