const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const Training = require("../models/Training");
const { createTrainingSchema, progressSchema, assessmentScoreSchema } = require("../validators/training.validators");
const { uploadAsset } = require("../utils/uploads");
const { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, createMemoryUpload } = require("../utils/multer");
const User = require("../models/User");
const { createNotification } = require("../services/notifications.service");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination,
  UNPAGINATED_MAX
} = require("../utils/pagination");

const router = express.Router();
const upload = createMemoryUpload({
  allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
  maxFileSizeMb: 100,
  maxFiles: 2
});


/**
 * Shapes one training for a *list* response.
 *
 * A Training document embeds a `completions` entry for every user who ever
 * opened it, each with its own `watchHistory` array. Serialising all of that
 * for every record meant the training list grew with the size of the workforce
 * multiplied by their viewing history — on a mature site the single largest
 * response the portal produced, and none of it was usable by the caller, who
 * can only act on their own progress.
 *
 * The list therefore carries:
 *   - `completions`   : only the requesting user's entry (kept as an array so
 *                       existing clients that iterate it keep working),
 *   - `completedCount`: how many people have completed it, which is the only
 *                       aggregate the reports module actually needed,
 *   - `myCompletion`  : the same entry, named for new code.
 * The full array is still available on the per-record detail routes.
 */
const toTrainingListItem = (record, userId) => {
  const completions = record.completions || [];
  const mine = completions.find((item) => String(item.user) === String(userId)) || null;
  const trimmedMine = mine
    ? { ...mine, watchHistory: undefined, watchCount: (mine.watchHistory || []).length }
    : null;

  return {
    ...record,
    completions: trimmedMine ? [trimmedMine] : [],
    myCompletion: trimmedMine,
    completedCount: completions.filter((item) => item.isCompleted).length,
    enrolledCount: completions.length
  };
};

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
      .populate("trainer", "name")
      .sort({ createdAt: -1 })
      .lean();
    if (shouldPaginate) {
      findQuery = findQuery.skip(pagination.skip).limit(pagination.limit);
    } else {
      findQuery = findQuery.limit(UNPAGINATED_MAX);
    }

    const [records, total] = await Promise.all([
      findQuery,
      Training.countDocuments(query)
    ]);
    res.json({
      success: true,
      records: records.map((record) => toTrainingListItem(record, req.user.id)),
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true, limit: UNPAGINATED_MAX, capped: total > UNPAGINATED_MAX }
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
      // Empty-string form fields must not be cast to ObjectId.
      trainer: payload.trainer || null,
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

// Derives the richer Assigned/In Progress/Completed/Failed lifecycle
// status alongside the existing isCompleted boolean (kept for backward
// compatibility — see the completionSchema comment in models/Training.js).
// A completion only becomes "failed" once an assessment score has actually
// been recorded and misses the training's passingScore; reaching 100%
// progress with no score yet (or no passingScore configured) is
// "completed" and certificate-eligible.
const computeCompletionStatus = (training, progress, assessmentScore) => {
  if (progress >= 100) {
    const hasPassingScore = training.passingScore !== null && training.passingScore !== undefined;
    const hasScore = assessmentScore !== null && assessmentScore !== undefined;
    if (hasPassingScore && hasScore && Number(assessmentScore) < Number(training.passingScore)) {
      return "failed";
    }
    return "completed";
  }
  if (progress > 0) return "in_progress";
  return "assigned";
};

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
      const completion = training.completions[existingIndex];
      completion.progress = parsed.data.progress;
      completion.isCompleted = completed;
      if (completed && !completion.completedAt) {
        completion.completedAt = new Date();
      }
      completion.status = computeCompletionStatus(training, parsed.data.progress, completion.assessmentScore);
      completion.watchHistory.push(watchEntry);
    } else {
      const completedAt = completed ? new Date() : null;
      training.completions.push({
        user: req.user.id,
        progress: parsed.data.progress,
        isCompleted: completed,
        status: computeCompletionStatus(training, parsed.data.progress, null),
        completedAt,
        // plaza is left blank here (default) and resolved from the live
        // User.plaza at certificate-issuance time instead — see
        // certificate.service.js#issueCertificateForCompletion.
        watchHistory: [watchEntry]
      });
    }

    await training.save();

    // Certificates are no longer auto-issued here. Reaching 100% only
    // marks the completion eligible; the employee (or a Safety
    // Manager/Admin on their behalf) must explicitly request the
    // certificate via POST /certificates/generate, which re-validates
    // eligibility server-side. See routes/certificates.routes.js.
    await audit(req, "progress_update", "training", parsed.data, training._id);
    res.json({ success: true, training });
  })
);

// Records an employee's assessment score against a training, and
// recomputes their completion status/eligibility. Restricted to the
// training's assigned trainer or a Safety Manager/Admin/Super Admin — an
// employee cannot self-report their own score.
router.post(
  "/:id/assessment",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const parsed = assessmentScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const training = await Training.findById(req.params.id);
    if (!training) throw new ApiError(404, "Training record not found");

    const isTrainer = training.trainer && String(training.trainer) === req.user.id;
    const isManager = ["safety_manager", "admin", "super_admin"].includes(req.user.role);
    if (!isTrainer && !isManager) {
      throw new ApiError(403, "Only the assigned trainer or a Safety Manager/Admin can record an assessment score", null, "PERMISSION_DENIED");
    }

    const completion = training.completions.find(
      (item) => item.user?.toString() === parsed.data.userId
    );
    if (!completion) throw new ApiError(404, "This employee has no completion record for this training");

    completion.assessmentScore = parsed.data.score;
    completion.status = computeCompletionStatus(training, completion.progress, parsed.data.score);
    await training.save();

    await audit(
      req,
      "training_assessment_recorded",
      "training",
      { userId: parsed.data.userId, score: parsed.data.score },
      training._id
    );
    res.json({ success: true, completion });
  })
);

router.get(
  "/history/me",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    // `completions.$` projects only the matching (i.e. this user's) subdocument
    // instead of shipping the whole array back and filtering it in JS.
    const records = await Training.find({
      "completions.user": req.user.id
    })
      .select({
        title: 1,
        category: 1,
        concept: 1,
        thumbnail: 1,
        trainerName: 1,
        trainer: 1,
        passingScore: 1,
        durationMinutes: 1,
        "completions.$": 1
      })
      .populate("trainer", "name")
      .lean();

    const history = records.map((record) => {
      const completion = (record.completions || [])[0];
      return {
        id: record._id,
        trainingId: record._id,
        title: record.title,
        category: record.category,
        concept: record.concept || "",
        thumbnail: record.thumbnail,
        trainerName: record.trainer?.name || record.trainerName || "",
        durationMinutes: record.durationMinutes ?? null,
        passingScore: record.passingScore ?? null,
        progress: completion?.progress || 0,
        isCompleted: completion?.isCompleted || false,
        status: completion?.status || "assigned",
        assessmentScore: completion?.assessmentScore ?? null,
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
