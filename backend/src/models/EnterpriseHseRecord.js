const mongoose = require("mongoose");
const { assetSchema, locationSchema } = require("../utils/media-metadata");
const { ENTERPRISE_HSE_MODULES } = require("../constants/enterprise-hse");

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    fromStatus: { type: String, default: "" },
    toStatus: { type: String, default: "" },
    note: { type: String, default: "", trim: true, maxlength: 2000 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, default: "" },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const checklistItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true, maxlength: 500 },
    result: {
      type: String,
      enum: ["Compliant", "Non-Compliant", "Not Applicable", "Pending"],
      default: "Pending"
    },
    remarks: { type: String, default: "", trim: true, maxlength: 1000 },
    actionOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dueDate: Date
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    storage: String,
    originalName: String,
    mimeType: String,
    size: Number,
    fileHash: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const makeSchema = (definition) => {
  const schema = new mongoose.Schema(
    {
      recordId: { type: String, unique: true, sparse: true, index: true },
      title: { type: String, required: true, trim: true, maxlength: 300 },
      description: { type: String, default: "", trim: true, maxlength: 10000 },
      category: { type: String, default: "", trim: true, maxlength: 120 },
      site: { type: String, default: "", trim: true, maxlength: 240 },
      location: { type: String, default: "", trim: true, maxlength: 500 },
      geoLocation: locationSchema,
      severity: {
        type: String,
        enum: [...definition.severities, ""],
        default: ""
      },
      priority: {
        type: String,
        enum: ["Low", "Medium", "High", "Urgent", ""],
        default: "Medium"
      },
      status: {
        type: String,
        enum: definition.statuses,
        default: definition.statuses[0],
        index: true
      },
      businessDate: Date,
      startDate: Date,
      dueDate: Date,
      expiryDate: Date,
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      createdByName: { type: String, default: "" },
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      tags: [{ type: String, trim: true, maxlength: 80 }],
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
      checklist: [checklistItemSchema],
      evidenceImages: [assetSchema],
      evidenceVideos: [assetSchema],
      attachments: [attachmentSchema],
      history: [historySchema],
      isArchived: { type: Boolean, default: false, index: true },
      version: { type: Number, default: 1, min: 1 }
    },
    {
      timestamps: true,
      collection: definition.collection,
      optimisticConcurrency: true
    }
  );

  schema.index({ status: 1, createdAt: -1 });
  schema.index({ site: 1, status: 1, createdAt: -1 });
  schema.index({ assignedTo: 1, status: 1, dueDate: 1 });
  schema.index({ severity: 1, status: 1, createdAt: -1 });
  schema.index({ expiryDate: 1, status: 1 });
  schema.index({ title: "text", description: "text", site: "text", category: "text", recordId: "text" });

  schema.pre("validate", function assignRecordId() {
    if (!this.recordId && this._id) {
      this.recordId = `${definition.prefix}-${String(this._id).slice(-8).toUpperCase()}`;
    }
  });

  schema.pre("validate", function boundEmbeddedOperationalData() {
    // The immutable AuditLog is authoritative. Embedded arrays are deliberately
    // bounded so frequently updated records cannot grow without limit.
    if (this.history?.length > 100) this.history = this.history.slice(-100);
    if (this.evidenceImages?.length > 100) this.evidenceImages = this.evidenceImages.slice(-100);
    if (this.evidenceVideos?.length > 100) this.evidenceVideos = this.evidenceVideos.slice(-100);
    if (this.attachments?.length > 100) this.attachments = this.attachments.slice(-100);
    if (this.checklist?.length > 250) this.checklist = this.checklist.slice(0, 250);
  });

  schema.set("toJSON", {
    transform: (_doc, ret) => {
      ret.module = definition.key;
      return ret;
    }
  });

  return schema;
};

const modelNameFor = (key) => `EnterpriseHse_${key.replace(/(^|-)(\w)/g, (_match, _dash, letter) => letter.toUpperCase())}`;

const HSE_MODELS = ENTERPRISE_HSE_MODULES.reduce((models, definition) => {
  const modelName = modelNameFor(definition.key);
  models[definition.key] = mongoose.models[modelName] || mongoose.model(modelName, makeSchema(definition));
  return models;
}, {});

const getHseModel = (moduleKey) => HSE_MODELS[moduleKey];

module.exports = {
  HSE_MODELS,
  getHseModel,
  makeSchema
};
