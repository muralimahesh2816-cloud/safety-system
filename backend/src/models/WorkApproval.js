const mongoose = require("mongoose");
const { assetSchema, locationSchema } = require("../utils/media-metadata");
const {
  WORK_STAGES,
  WORK_STAGE_VALUES,
  isPostApprovalStage,
  normalizeWorkStage
} = require("../constants/work-status");

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
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    remainingChainageSegments: { type: [chainageRangeSchema], default: [] },
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

const locationAuditSchema = new mongoose.Schema(
  {
    previousLocation: locationSchema,
    newLocation: locationSchema,
    reason: { type: String, required: true, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedByName: { type: String, default: "" },
    updatedByRole: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
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
    geoLocation: locationSchema,
    locationAuditHistory: [locationAuditSchema],
    chainage: { type: String, default: "" },
    chainageNo: { type: String, default: "" },
    chainageFrom: { type: String, default: "", trim: true },
    chainageTo: { type: String, default: "", trim: true },
    requestedChainageFrom: { type: String, required: true, trim: true },
    requestedChainageTo: { type: String, required: true, trim: true },
    approvedChainage: { type: chainageRangeSchema, default: () => ({}) },
    approvedChainageFrom: { type: String, default: "", trim: true },
    approvedChainageTo: { type: String, default: "", trim: true },
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
        "Pending Approval",
        "Rejected",
        "Final Approved",
        ...WORK_STAGE_VALUES
      ],
      default: WORK_STAGES.PENDING_CHECK
    },
    workflowStage: {
      type: String,
      enum: ["Pending Approval", ...WORK_STAGE_VALUES],
      default: WORK_STAGES.PENDING_CHECK
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
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    remainingChainageSegments: { type: [chainageRangeSchema], default: [] },
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
    assignedChecker: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedCheckerName: { type: String, default: "" },
    assignedCheckerRole: { type: String, default: "" },
    assignedCheckerAt: Date,
    assignedRecommender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedRecommenderName: { type: String, default: "" },
    assignedRecommenderRole: { type: String, default: "" },
    assignedRecommenderAt: Date,
    assignedFinalApprover: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedFinalApproverName: { type: String, default: "" },
    assignedFinalApproverRole: { type: String, default: "" },
    assignedFinalApproverAt: Date,
    idempotencyKey: { type: String, trim: true },
    startDate: Date,
    dueDate: Date
  },
  { timestamps: true }
);

workApprovalSchema.pre("validate", function normalizeChainageRange() {
  const legacyFrom = this.chainageFrom || this.chainageNo || this.chainage || "";
  const legacyTo = this.chainageTo || legacyFrom;
  if (!this.requestedChainageFrom) this.requestedChainageFrom = legacyFrom;
  if (!this.requestedChainageTo) this.requestedChainageTo = legacyTo;
  if (!this.approvedChainage) this.approvedChainage = {};
  const normalizedStage = normalizeWorkStage(this);
  if (isPostApprovalStage(normalizedStage)) {
    const approvedFrom = this.approvedChainageFrom || this.approvedChainage.from || this.requestedChainageFrom;
    const approvedTo = this.approvedChainageTo || this.approvedChainage.to || this.requestedChainageTo;
    this.approvedChainageFrom = approvedFrom;
    this.approvedChainageTo = approvedTo;
    this.approvedChainage.from = approvedFrom;
    this.approvedChainage.to = approvedTo;
  }
  if (!this.approvalNumber && this._id) {
    this.approvalNumber = `WA-${String(this._id).slice(-8).toUpperCase()}`;
  }
  if (!this.workflowStage) {
    const derivedStage = normalizeWorkStage(this);
    this.workflowStage = derivedStage === WORK_STAGES.UNKNOWN ? WORK_STAGES.PENDING_CHECK : derivedStage;
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
workApprovalSchema.index({ createdBy: 1, createdAt: -1 });
workApprovalSchema.index({ location: 1, createdAt: -1 });
workApprovalSchema.index({ approvalNumber: 1 });
workApprovalSchema.index({ status: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ workType: 1, createdAt: -1 });
workApprovalSchema.index({ location: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ checkedById: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ recommendedById: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ approvedById: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ assignedChecker: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ assignedRecommender: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ assignedFinalApprover: 1, workflowStage: 1, createdAt: -1 });
workApprovalSchema.index({ completedAt: -1 });
workApprovalSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("WorkApproval", workApprovalSchema);
