const { z } = require("zod");

const createWorkSchema = z.object({
  title: z.string().optional().default(""),
  workType: z.string().min(2),
  category: z.string().optional().default("General"),
  plaza: z.string().optional().default(""),
  location: z.string().min(2),
  chainage: z.string().optional().default(""),
  chainageNo: z.string().optional().default(""),
  workersCount: z.coerce.number().min(0).optional().default(0),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional().default("Medium"),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional()
});

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
  workflowActionSchema,
  statusUpdateSchema,
  commentSchema,
  signatureSchema
};
