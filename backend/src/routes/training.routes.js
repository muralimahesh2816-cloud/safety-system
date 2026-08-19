const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const Training = require("../models/Training");
const { issueCertificateForCompletion } = require("../services/certificate.service");
const { createTrainingSchema, progressSchema } = require("../validators/training.validators");
const { uploadAsset } = require("../utils/uploads");
const { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, createMemoryUpload } = require("../utils/multer");
const User = require("../models/User");
const { createNotification } = require("../services/notifications.service");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../utils/pagination");

const router = express.Router();
const upload = createMemoryUpload({
  allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
  maxFileSizeMb: 100,
  maxFiles: 2
});

router.get(
  "/",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const { category, search, role } = req.query;
    const query = { isPublished: true };
    if (category) query.category = category;
    if (role) {
      query.$and = [
        {
          $or: [
            { recommendedForRoles: { $size: 0 } },
            { recommendedForRoles: role }
          ]
        }
      ];
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$and = [
        ...(query.$and || []),
        {
          $or: [{ title: regex }, { description: regex }]
        }
      ];
    }

    const shouldPaginate = hasPagination(req.query);
    const pagination = getPagination(req.query);
    let findQuery = Training.find(query)
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });
    if (shouldPaginate) {
      findQuery = findQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const [records, total] = await Promise.all([
      findQuery,
      Training.countDocuments(query)
    ]);
    res.json({
      success: true,
      records,
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true }
    });
  })
);

router.post(
  "/",
  authMiddleware,
  authorizePermission("training", "create"),
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    let parsedRoles = [];
    if (req.body.recommendedForRoles) {
      try {
        parsedRoles = JSON.parse(req.body.recommendedForRoles);
      } catch (_error) {
        throw new ApiError(400, "recommendedForRoles must be a valid JSON array");
      }
    }
    const normalizedBody = {
      ...req.body,
      recommendedForRoles: parsedRoles,
      tags: req.body.tags
    };

    const parsed = createTrainingSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const thumbnailFile = req.files?.thumbnail?.[0];
    const videoFile = req.files?.video?.[0];

    const [thumbnail, video] = await Promise.all([
      uploadAsset(thumbnailFile, "safety-hse/training/thumbnails", "image"),
      uploadAsset(videoFile, "safety-hse/training/videos", "video")
    ]);

    const payload = parsed.data;
    const training = await Training.create({
      ...payload,
      tags: typeof payload.tags === "string" ? payload.tags.split(",").map((tag) => tag.trim()) : [],
      thumbnail,
      video,
      createdBy: req.user.id
    });

    const recipientQuery =
      payload.recommendedForRoles && payload.recommendedForRoles.length > 0
        ? { role: { $in: payload.recommendedForRoles }, status: "active" }
        : { status: "active" };
    const recipients = await User.find(recipientQuery).select("_id");
    await Promise.all(
      recipients.map((recipient) =>
        createNotification({
          userId: recipient._id,
          type: "training",
          title: "New Training Available",
          message: `${training.title} is now available`,
          data: { trainingId: training._id }
        })
      )
    );

    await audit(req, "create", "training", { title: training.title }, training._id);
    res.status(201).json({ success: true, training });
  })
);

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const training = await Training.findById(req.params.id);
    if (!training) throw new ApiError(404, "Training record not found");

    training.isPublished = false;
    await training.save();

    await audit(req, "delete", "training", { title: training.title }, training._id);
    res.json({ success: true, message: "Training concept deleted" });
  })
);

router.patch(
  "/:id/progress",
  authMiddleware,
  authorizePermission("training", "update"),
  asyncHandler(async (req, res) => {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const training = await Training.findById(req.params.id);
    if (!training) throw new ApiError(404, "Training record not found");

    const existingIndex = training.completions.findIndex(
      (completion) => completion.user?.toString() === req.user.id
    );

    const completed = parsed.data.progress >= 100;
    const watchEntry = {
      watchedAt: new Date(),
      seconds: parsed.data.seconds
    };

    let justCompletedAt = null;

    if (existingIndex >= 0) {
      training.completions[existingIndex].progress = parsed.data.progress;
      training.completions[existingIndex].isCompleted = completed;
      if (completed && !training.completions[existingIndex].completedAt) {
        justCompletedAt = new Date();
        training.completions[existingIndex].completedAt = justCompletedAt;
        training.completions[existingIndex].certificateUrl = `/certificates/${training._id}-${req.user.id}.pdf`;
      }
      training.completions[existingIndex].watchHistory.push(watchEntry);
    } else {
      justCompletedAt = completed ? new Date() : null;
      training.completions.push({
        user: req.user.id,
        progress: parsed.data.progress,
        isCompleted: completed,
        completedAt: justCompletedAt,
        certificateUrl: completed ? `/certificates/${training._id}-${req.user.id}.pdf` : "",
        watchHistory: [watchEntry]
      });
    }

    await training.save();

    if (justCompletedAt) {
      // First time this user has completed this training — issue their
      // certificate. Idempotent, so a retry or a race with another
      // request for the same completion is safe.
      await issueCertificateForCompletion({
        trainingId: training._id,
        trainingTitle: training.title,
        trainingCategory: training.category,
        userId: req.user.id,
        userName: req.user.name,
        completedAt: justCompletedAt
      });
    }

    await audit(req, "progress_update", "training", parsed.data, training._id);
    res.json({ success: true, training });
  })
);

router.get(
  "/history/me",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const records = await Training.find({
      "completions.user": req.user.id
    }).select("title category completions thumbnail");

    const history = records.map((record) => {
      const completion = record.completions.find(
        (item) => item.user?.toString() === req.user.id
      );
      return {
        id: record._id,
        title: record.title,
        category: record.category,
        thumbnail: record.thumbnail,
        progress: completion?.progress || 0,
        completedAt: completion?.completedAt || null,
        watchHistory: completion?.watchHistory || []
      };
    });

    res.json({ success: true, history });
  })
);

router.get(
  "/recommendations/me",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const byRole = await Training.find({
      isPublished: true,
      $or: [
        { recommendedForRoles: { $size: 0 } },
        { recommendedForRoles: req.user.role }
      ]
    })
      .limit(12)
      .sort({ createdAt: -1 });
    res.json({ success: true, recommendations: byRole });
  })
);

router.get(
  "/certificates/me",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const records = await Training.find({
      completions: {
        $elemMatch: {
          user: req.user.id,
          isCompleted: true
        }
      }
    }).select("title category completions");

    const certificates = records
      .map((record) => {
        const completion = record.completions.find(
          (item) => item.user?.toString() === req.user.id && item.isCompleted
        );
        return completion
          ? {
              trainingId: record._id,
              title: record.title,
              category: record.category,
              certificateUrl: completion.certificateUrl,
              completedAt: completion.completedAt
            }
          : null;
      })
      .filter(Boolean);

    res.json({ success: true, certificates });
  })
);

module.exports = router;
