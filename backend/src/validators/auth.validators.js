const { z } = require("zod");
const { ROLES } = require("../constants/roles");

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().min(8).max(20).optional().default(""),
  password: z
    .string()
    .min(8)
    .refine((val) => passwordRegex.test(val), {
      message:
        "Password must include uppercase, lowercase, and a number with min 8 chars"
    }),
  role: z.nativeEnum(ROLES).optional().default(ROLES.USER)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

module.exports = {
  registerSchema,
  loginSchema
};
