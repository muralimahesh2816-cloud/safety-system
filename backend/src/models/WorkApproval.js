const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    storage: String
  },
  { _id: false }
);

const stageActorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    description: { type: String, default: "" },
    reviewFindings: { type: String, default: "" },
    recommendationRemarks: { type: String, default: "" },
    approvalRemarks: { type: String, default: "" },
    date: Date
  },
  { _id: false }
);

const chainageRangeSchema = new mongoose.Schema(
  {
    from: { type: String, default: "" },
    to: { type: String, default: "" }
  },
  { _id: false }
);

const completionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    description: { type: String, default: "" },
    completedChainageFrom: { type: String, default: "" },
    completedChainageTo: { type: String, default: "" },
    remainingChainageFrom: { type: String, default: "" },
    remainingChainageTo: { type: String, default: "" },
    partialCompletionReason: { type: String, default: "" },
    date: Date
  },
  { _id: false }
);

const returnedHistorySchema = new mongoose.Schema(
  {
    returnedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    returnedByName: { type: String, default: "" },
    returnedByRole: { type: String, default: "" },
    returnedFromStage: { type: String, default: "" },
    correctionReason: { type: String, default: "" },
    returnedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chainageAuditSchema = new mongoose.Schema(
  {
    approvedChainageFrom: { type: String, default: "" },
    approvedChainageTo: { type: String, default: "" },
    completedChainageFrom: { type: String, default: "" },
    completedChainageTo: { type: String, default: "" },
    remainingChainageFrom: { type: String, default: "" },
    remainingChainageTo: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String, default: "" },
    updatedByRole: { type: String, default: "" },
    updateDescription: { type: String, default: "" },
    partialCompletionReason: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
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
    approvedChainage: { type: chainageRangeSchema, default: () => ({}) },
    workersCount: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium"
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Under Review",
        "Pending Check",
        "Pending Recommendation",
        "Pending Approval",
        "Pending Final Approval",
        "Approved",
        "Partially Completed",
        "Rejected",
        "Returned for Correction",
        "Completed"
      ],
      default: "Pending Check"
    },
    workflowStage: {
      type: String,
      enum: [
        "Pending Check",
        "Pending Recommendation",
        "Pending Approval",
        "Pending Final Approval",
        "Approved",
        "Partially Completed",
        "Returned for Correction",
        "Completed"
      ],
      default: "Pending Check"
    },
    beforeImages: [assetSchema],
    afterImages: [assetSchema],
    beforeVideos: [assetSchema],
    afterVideos: [assetSchema],
    beforeImage: { type: String, default: "" },
    afterImage: { type: String, default: "" },
    beforeVideo: { type: String, default: "" },
    afterVideo: { type: String, default: "" },
    approvalNumber: { type: String, default: "" },
    checkedBy: { type: String, default: "", trim: true },
    checkedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    checkedByRole: { type: String, default: "" },
    checkedDescription: { type: String, default: "", trim: true },
    checkedAt: Date,
    checked: stageActorSchema,
    recommendedBy: { type: String, default: "", trim: true },
    recommendedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recommendedByRole: { type: String, default: "" },
    recommendedDescription: { type: String, default: "", trim: true },
    recommendedAt: Date,
    recommended: stageActorSchema,
    approvedBy: { type: String, default: "" },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByRole: { type: String, default: "" },
    approvalDescription: { type: String, default: "", trim: true },
    approvedAt: Date,
    approved: stageActorSchema,
    returnedBy: { type: String, default: "" },
    returnedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    returnedByRole: { type: String, default: "" },
    returnDescription: { type: String, default: "", trim: true },
    returnStage: { type: String, default: "" },
    returnedAt: Date,
    returned: stageActorSchema,
    returnedHistory: [returnedHistorySchema],
    completedBy: { type: String, default: "" },
    completedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedByRole: { type: String, default: "" },
    completionDescription: { type: String, default: "", trim: true },
    completedChainageFrom: { type: String, default: "" },
    completedChainageTo: { type: String, default: "" },
    remainingChainageFrom: { type: String, default: "" },
    remainingChainageTo: { type: String, default: "" },
    partialCompletionReason: { type: String, default: "" },
    completedAt: Date,
    completion: completionSchema,
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
    chainageAuditHistory: [chainageAuditSchema],
    digitalSignatures: [signatureSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startDate: Date,
    dueDate: Date
  },
  { timestamps: true }
);

workApprovalSchema.pre("validate", function normalizeChainageRange() {
  const legacyChainage = this.chainageNo || this.chainage || "";
  if (!this.chainageFrom) this.chainageFrom = legacyChainage;
  if (!this.chainageTo) this.chainageTo = legacyChainage;
  if (!this.chainage) this.chainage = this.chainageFrom;
  if (!this.chainageNo) this.chainageNo = this.chainageFrom;
  if (!this.approvedChainage) this.approvedChainage = {};
  if (!this.approvedChainage.from) this.approvedChainage.from = this.chainageFrom;
  if (!this.approvedChainage.to) this.approvedChainage.to = this.chainageTo;
  if (!this.approvalNumber && this._id) {
    this.approvalNumber = `WA-${String(this._id).slice(-8).toUpperCase()}`;
  }
  if (!this.workflowStage) {
    if (this.status === "Completed") this.workflowStage = "Completed";
    else if (this.status === "Partially Completed") this.workflowStage = "Partially Completed";
    else if (this.status === "Approved") this.workflowStage = "Approved";
    else if (this.status === "Rejected") this.workflowStage = "Returned for Correction";
    else if (this.recommendedAt || this.recommendedBy) this.workflowStage = "Pending Final Approval";
    else if (this.checkedAt || this.checkedBy) this.workflowStage = "Pending Recommendation";
    else this.workflowStage = "Pending Check";
  }
  if (this.workflowStage === "Pending Approval") this.workflowStage = "Pending Final Approval";
  if (this.status === "Pending Approval") this.status = "Pending Final Approval";
  if (!this.status || this.status === "Pending" || this.status === "Under Review") {
    this.status = this.workflowStage;
  }
});

workApprovalSchema.index({ status: 1, priority: 1, createdAt: -1 });
workApprovalSchema.index({ chainageFrom: 1, chainageTo: 1, chainageNo: 1 });
workApprovalSchema.index({ workflowStage: 1, createdAt: -1 });

module.exports = mongoose.model("WorkApproval", workApprovalSchema);
