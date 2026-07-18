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
  status: z.enum([
    "Pending",
    "Under Review",
    "Pending Check",
    "Pending Approval",
    "Pending Final Approval",
    "Approved",
    "Partially Completed",
    "Rejected",
    "Returned for Correction",
    "Completed"
  ]),
  comment: z.string().optional().default(""),
  approvedBy: z.string().optional().default(""),
  checkedBy: z.string().trim().optional()
});

const stageActionSchema = z.object({
  description: z.string().trim().optional().default(""),
  reviewFindings: z.string().trim().optional().default(""),
  approvalRemarks: z.string().trim().optional().default(""),
  overrideReason: z.string().trim().optional().default("")
});

const returnWorkSchema = z.object({
  description: z.string().trim().optional().default(""),
  correctionReason: z.string().trim().optional().default(""),
  overrideReason: z.string().trim().optional().default("")
});

const completeWorkSchema = z.object({
  description: z.string().trim().min(1, "Completion description is required"),
  completedChainageFrom: z.string().trim().optional().default(""),
  completedChainageTo: z.string().trim().optional().default(""),
  partialCompletionReason: z.string().trim().optional().default("")
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
  stageActionSchema,
  returnWorkSchema,
  completeWorkSchema,
  commentSchema,
  signatureSchema
};
