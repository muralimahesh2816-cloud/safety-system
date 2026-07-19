const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/async-handler");
const { reverseGeocode } = require("../services/location.service");

const router = express.Router();

router.post(
  "/reverse-geocode",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const data = await reverseGeocode(req.body?.latitude, req.body?.longitude, {
      requestId: req.requestId
    });
    res.json({ success: true, data });
  })
);

module.exports = router;
