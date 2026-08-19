const { z } = require("zod");

const profileSchema = z.object({
  companyName: z.string().min(2),
  address: z.string().optional().default(""),
  contactInformation: z
    .object({
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional().default("")
    })
    .optional(),
  gstNumber: z.string().optional().default(""),
  website: z.string().optional().default("")
});

const brandingSchema = z.object({
  themeSelection: z.enum(["dark", "light", "system"]).optional().default("dark"),
  accentColor: z.string().optional().default("#1dd3b0"),
  dashboardBanner: z.string().optional().default(""),
  loginBackground: z.string().optional().default("")
});

const securitySchema = z.object({
  sessionTimeout: z.coerce.number().min(5).max(180).optional().default(30),
  passwordPolicy: z
    .object({
      minLength: z.coerce.number().min(8).max(24).optional().default(8),
      requireUppercase: z.boolean().optional().default(true),
      requireLowercase: z.boolean().optional().default(true),
      requireNumber: z.boolean().optional().default(true),
      requireSpecial: z.boolean().optional().default(false)
    })
    .optional(),
  loginAttempts: z.coerce.number().min(3).max(10).optional().default(5),
  twoFactorAuthentication: z.boolean().optional().default(false)
});

const certificateSignatorySchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  title: z.string().trim().min(2).max(160).optional().default("Authorized Signatory - HSE Department")
});

const certificateNumberFormatSchema = z.object({
  certificateNumberPrefix: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use only uppercase letters, numbers, and hyphens")
    .optional()
    .default("UTPL-HSE-TRN")
});

module.exports = {
  profileSchema,
  brandingSchema,
  securitySchema,
  certificateSignatorySchema,
  certificateNumberFormatSchema
};
