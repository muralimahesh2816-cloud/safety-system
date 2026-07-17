const mongoose = require("mongoose");

const completionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    progress: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    completedAt: Date,
    certificateUrl: String,
    watchHistory: [
      {
        watchedAt: { type: Date, default: Date.now },
        seconds: Number
      }
    ]
  },
  { _id: false }
);

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    thumbnail: {
      url: String,
      publicId: String,
      storage: String,
      originalName: String,
      mimeType: String,
      size: Number,
      fileHash: String
    },
    video: {
      url: String,
      publicId: String,
      storage: String,
      originalName: String,
      mimeType: String,
      size: Number,
      fileHash: String
    },
    tags: [String],
    durationMinutes: Number,
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recommendedForRoles: [String],
    completions: [completionSchema]
  },
  { timestamps: true }
);

trainingSchema.index({ category: 1, isPublished: 1 });
trainingSchema.index({ isPublished: 1, createdAt: -1 });
trainingSchema.index({ createdBy: 1, createdAt: -1 });
trainingSchema.index({ recommendedForRoles: 1, isPublished: 1 });
trainingSchema.index({ "completions.user": 1, "completions.isCompleted": 1 });

module.exports = mongoose.model("Training", trainingSchema);
