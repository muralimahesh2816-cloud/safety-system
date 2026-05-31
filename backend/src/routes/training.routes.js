const express = require("express");
const multer = require("multer");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const Training = require("../models/Training");
const { createTrainingSchema, progressSchema } = require("../validators/training.validators");
const { uploadAsset } = require("../utils/uploads");
const User = require("../models/User");
const { createNotification } = require("../services/notifications.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const { category, search } = req.query;
    const query = { isPublished: true };
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const records = await Training.find(query)
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, records });
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

    if (existingIndex >= 0) {
      training.completions[existingIndex].progress = parsed.data.progress;
      training.completions[existingIndex].isCompleted = completed;
      if (completed && !training.completions[existingIndex].completedAt) {
        training.completions[existingIndex].completedAt = new Date();
        training.completions[existingIndex].certificateUrl = `/certificates/${training._id}-${req.user.id}.pdf`;
      }
      training.completions[existingIndex].watchHistory.push(watchEntry);
    } else {
      training.completions.push({
        user: req.user.id,
        progress: parsed.data.progress,
        isCompleted: completed,
        completedAt: completed ? new Date() : null,
        certificateUrl: completed ? `/certificates/${training._id}-${req.user.id}.pdf` : "",
        watchHistory: [watchEntry]
      });
    }

    await training.save();
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
