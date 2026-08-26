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

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6 digit code")
});

const resendOtpSchema = z.object({
  email: z.string().email()
});

// Mobile sign-in. The number is accepted in whatever shape the user typed it;
// utils/phone.js is what decides whether it is valid and what it normalises to,
// so the rule lives in one place rather than being half-expressed as a regex
// here and half-expressed there.
const mobileOtpRequestSchema = z.object({
  mobile: z.string().min(6).max(24)
});

const mobileOtpVerifySchema = z.object({
  mobile: z.string().min(6).max(24),
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6 digit code")
});

module.exports = {
  registerSchema,
  loginSchema,
  otpSchema,
  resendOtpSchema,
  mobileOtpRequestSchema,
  mobileOtpVerifySchema
};
