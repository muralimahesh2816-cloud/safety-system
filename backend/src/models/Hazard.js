const mongoose = require("mongoose");
const { assetSchema } = require("../utils/media-metadata");

const correctiveActionSchema = new mongoose.Schema(
  {
    action: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetDate: Date,
    status: {
      type: String,
      enum: ["Open", "In Progress", "Completed"],
      default: "Open"
    }
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    label: String,
    description: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const hazardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium"
    },
    likelihood: {
      type: String,
      enum: ["Rare", "Possible", "Likely", "Almost Certain"],
      default: "Possible"
    },
    riskScore: { type: Number, default: 0 },
    date: Date,
    plaza: { type: String, default: "" },
    location: { type: String, required: true },
    action: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Closed"],
      default: "Open"
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reportedByName: { type: String, default: "" },
    correctiveActions: [correctiveActionSchema],
    evidenceImages: [assetSchema],
    evidenceVideos: [assetSchema],
    closureImages: [assetSchema],
    closureVideos: [assetSchema],
    beforeImage: { type: String, default: "" },
    beforeVideo: { type: String, default: "" },
    afterImage: { type: String, default: "" },
    afterVideo: { type: String, default: "" },
    closureNotes: String,
    timeline: [timelineSchema]
  },
  { timestamps: true }
);

hazardSchema.index({ status: 1, category: 1, severity: 1 });
hazardSchema.index({ status: 1, createdAt: -1 });
hazardSchema.index({ location: 1, createdAt: -1 });
hazardSchema.index({ reportedBy: 1, createdAt: -1 });
hazardSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Hazard", hazardSchema);
