const mongoose =
  require("mongoose");

const CompanySettingsSchema =
  new mongoose.Schema({

    companyName: String,

    companyEmail: String,

    phone: String,

    address: String,

    website: String,

    logo: String,

    timezone: String,

    theme: String,

    sessionTimeout: Number

  });

module.exports =
  mongoose.model(
    "CompanySettings",
    CompanySettingsSchema
  );