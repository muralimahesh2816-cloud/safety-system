const { z } = require("zod");
const { validateChainageRange } = require("../utils/chainage");

const withChainageValidation = (schema) =>
  schema.superRefine((value, ctx) => {
    const validation = validateChainageRange(value);
    if (!validation.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [validation.field],
        message: validation.message
      });
    }
  });

const createWorkSchema = withChainageValidation(z.object({
  title: z.string().optional().default(""),
  workType: z.string().min(2),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().optional().default("General"),
  plaza: z.string().optional().default(""),
  location: z.string().min(2),
  chainage: z.string().optional().default(""),
  chainageNo: z.string().optional().default(""),
  chainageFrom: z.string().trim().optional().default(""),
  chainageTo: z.string().trim().optional().default(""),
  workersCount: z.coerce.number().min(1, "Workers Count must be greater than zero").optional().default(1),
  checkedBy: z.string().trim().min(1, "Checked By is required"),
  recommendedBy: z.string().trim().min(1, "Recommended By is required"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional().default("Medium"),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional()
}));

const updateWorkSchema = withChainageValidation(z.object({
  title: z.string().trim().max(160).optional().default(""),
  workType: z.string().trim().min(2).optional(),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().optional().default("General"),
  plaza: z.string().trim().optional().default(""),
  location: z.string().trim().min(2).optional(),
  chainage: z.string().trim().optional().default(""),
  chainageNo: z.string().trim().optional().default(""),
  chainageFrom: z.string().trim().optional().default(""),
  chainageTo: z.string().trim().optional().default(""),
  workersCount: z.coerce.number().min(1, "Workers Count must be greater than zero").optional(),
  checkedBy: z.string().trim().min(1, "Checked By is required").optional(),
  recommendedBy: z.string().trim().min(1, "Recommended By is required").optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional().default("Medium"),
  startDate: z.string().optional(),
  dueDate: z.string().optional()
}));

const workflowActionSchema = z.object({
  level: z.coerce.number().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  comments: z.string().optional().default("")
});

const statusUpdateSchema = z.object({
  status: z.enum(["Pending", "Under Review", "Approved", "Rejected", "Completed"]),
  comment: z.string().optional().default(""),
  approvedBy: z.string().optional().default("")
});

const commentSchema = z.object({
  text: z.string().min(1)
});

const signatureSchema = z.object({
  signatureText: z.string().min(2)
});

module.exports = {
  createWorkSchema,
  updateWorkSchema,
  workflowActionSchema,
  statusUpdateSchema,
  commentSchema,
  signatureSchema
};
