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

const updateHazardSchema = z.object({
  title: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().min(2).optional(),
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional().default("Medium"),
  likelihood: z
    .enum(["Rare", "Possible", "Likely", "Almost Certain"])
    .optional()
    .default("Possible"),
  riskScore: z.coerce.number().min(0).max(25).optional(),
  date: z.string().optional(),
  plaza: z.string().trim().optional().default(""),
  location: z.string().trim().min(2).optional(),
  action: z.string().trim().optional().default(""),
  reportedBy: z.string().trim().optional().default("")
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
  closureNotes: z
    .string()
    .trim()
    .min(2, "Corrective action is required")
    .max(1000, "Corrective action must not exceed 1000 characters"),
  status: z.enum(["Closed"]).optional().default("Closed")
});

module.exports = {
  createHazardSchema,
  updateHazardSchema,
  assignHazardSchema,
  correctiveActionSchema,
  closeHazardSchema
};
