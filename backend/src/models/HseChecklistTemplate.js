const mongoose = require("mongoose");
const { ENTERPRISE_HSE_KEYS } = require("../constants/enterprise-hse");

const templateItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true, maxlength: 500 },
    guidance: { type: String, default: "", trim: true, maxlength: 1000 },
    critical: { type: Boolean, default: false }
  },
  { _id: true }
);

const hseChecklistTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    moduleKey: { type: String, enum: ENTERPRISE_HSE_KEYS, required: true },
    category: { type: String, default: "", trim: true, maxlength: 120 },
    items: {
      type: [templateItemSchema],
      validate: {
        validator: (items) => items.length > 0 && items.length <= 250,
        message: "Checklist templates require 1 to 250 items"
      }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

hseChecklistTemplateSchema.index({ moduleKey: 1, category: 1, isActive: 1, name: 1 });
hseChecklistTemplateSchema.index({ moduleKey: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("HseChecklistTemplate", hseChecklistTemplateSchema);
