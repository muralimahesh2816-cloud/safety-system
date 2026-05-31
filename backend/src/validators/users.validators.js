const { z } = require("zod");
const { ROLES } = require("../constants/roles");

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().max(20).optional().default(""),
  role: z.nativeEnum(ROLES),
  password: z.string().min(8)
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  mobile: z.string().max(20).optional(),
  role: z.nativeEnum(ROLES).optional(),
  status: z.enum(["active", "blocked"]).optional(),
  permissions: z.record(z.any()).optional()
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8)
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema
};
