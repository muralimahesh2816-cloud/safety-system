const mongoose = require("mongoose");

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "Enterprise Safety" },
    logo: {
      url: String,
      publicId: String,
      storage: String
    },
    address: { type: String, default: "" },
    contactInformation: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" }
    },
    gstNumber: { type: String, default: "" },
    website: { type: String, default: "" },
    branding: {
      themeSelection: { type: String, default: "dark" },
      accentColor: { type: String, default: "#1dd3b0" },
      dashboardBanner: { type: String, default: "" },
      loginBackground: { type: String, default: "" }
    },
    security: {
      sessionTimeout: { type: Number, default: 30 },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        requireNumber: { type: Boolean, default: true },
        requireSpecial: { type: Boolean, default: false }
      },
      loginAttempts: { type: Number, default: 5 },
      twoFactorAuthentication: { type: Boolean, default: false }
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanySettings", companySettingsSchema);
