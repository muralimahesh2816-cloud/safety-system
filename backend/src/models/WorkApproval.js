const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    storage: String
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    level: Number,
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    comments: String,
    actedAt: Date
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: { type: Date, default: Date.now }
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

const signatureSchema = new mongoose.Schema(
  {
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: String,
    signatureText: String,
    signedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const workApprovalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    workType: { type: String, required: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "General" },
    plaza: { type: String, default: "" },
    location: { type: String, required: true },
    chainage: { type: String, default: "" },
    chainageNo: { type: String, default: "" },
    chainageFrom: { type: String, required: true, trim: true },
    chainageTo: { type: String, required: true, trim: true },
    workersCount: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium"
    },
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Approved", "Rejected", "Completed"],
      default: "Pending"
    },
    beforeImages: [assetSchema],
    afterImages: [assetSchema],
    beforeImage: { type: String, default: "" },
    afterImage: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    workflow: [workflowSchema],
    comments: [commentSchema],
    approvalHistory: [
      {
        action: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        comment: String,
        at: { type: Date, default: Date.now }
      }
    ],
    timeline: [timelineSchema],
    digitalSignatures: [signatureSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startDate: Date,
    dueDate: Date
  },
  { timestamps: true }
);

workApprovalSchema.pre("validate", function normalizeChainageRange() {
  const legacyChainage = this.chainageNo || this.chainage || "";
  if (!this.chainageFrom) this.chainageFrom = legacyChainage;
  if (!this.chainageTo) this.chainageTo = this.chainageFrom || legacyChainage;
  if (!this.chainage) this.chainage = this.chainageFrom;
  if (!this.chainageNo) this.chainageNo = this.chainageFrom;
});

workApprovalSchema.index({ status: 1, priority: 1, createdAt: -1 });
workApprovalSchema.index({ chainageFrom: 1, chainageTo: 1, chainageNo: 1 });

module.exports = mongoose.model("WorkApproval", workApprovalSchema);
