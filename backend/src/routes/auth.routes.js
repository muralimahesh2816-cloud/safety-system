const express = require("express");
const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const validate = require("../middleware/validate.middleware");
const authMiddleware = require("../middleware/auth.middleware");
const audit = require("../middleware/audit.middleware");
const {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema
} = require("../validators/auth.validators");
const User = require("../models/User");
const SessionToken = require("../models/SessionToken");
const CompanySettings = require("../models/CompanySettings");
const { ROLES } = require("../constants/roles");
const {
  normalizePagePermissions,
  toActionPermissions
} = require("../middleware/permission.middleware");
const { env, isProduction } = require("../config/env");
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  parseExpiryToDate
} = require("../utils/tokens");
const { issueCsrfToken } = require("../middleware/csrf.middleware");
const { otpRateLimiter } = require("../middleware/rateLimit.middleware");
const { setOtpForUser, verifyOtpForUser, maskEmail } = require("../services/auth.service");

const router = express.Router();

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/"
};

const buildAuthPayload = (user) => ({
  sub: user._id.toString(),
  role: user.role,
  email: user.email,
  name: user.name
});

const createSession = async (user, req, res) => {
  const payload = buildAuthPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const tokenHash = hashToken(refreshToken);

  await SessionToken.create({
    user: user._id,
    tokenHash,
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip,
    expiresAt: parseExpiryToDate(env.jwtRefreshExpiresIn)
  });

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  const csrfToken = issueCsrfToken(res);

  return {
    accessToken,
    csrfToken
  };
};

const appendLoginHistory = (user, req, successful) => {
  user.loginHistory = user.loginHistory || [];
  user.loginHistory.unshift({
    timestamp: new Date(),
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
    successful
  });
  if (user.loginHistory.length > 30) {
    user.loginHistory = user.loginHistory.slice(0, 30);
  }
};

router.get(
  "/csrf",
  asyncHandler(async (_req, res) => {
    const token = issueCsrfToken(res);
    res.json({ success: true, csrfToken: token });
  })
);

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      throw new ApiError(409, "User already exists");
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;
    if (!token) {
      throw new ApiError(401, "Authentication token is required to create users");
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_error) {
      throw new ApiError(401, "Invalid access token for user creation");
    }
    const creator = await User.findById(payload.sub);
    if (!creator || ![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(creator.role)) {
      throw new ApiError(403, "Only admins can create users");
    }

    const password = await bcrypt.hash(req.body.password, env.bcryptRounds);
    const role = req.body.role || ROLES.USER;
    const user = await User.create({
      ...req.body,
      role,
      password,
      permissions: normalizePagePermissions(req.body.permissions, role)
    });

    await audit(req, "create", "users", { email: user.email, role: user.role }, user._id);

    res.status(201).json({
      success: true,
      message: "User created",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.post(
  "/login",
  otpRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    const settings = await CompanySettings.findOne().select("security.loginAttempts");
    const maxAttempts = settings?.security?.loginAttempts || 5;

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(
        423,
        `Account locked due to failed attempts. Try after ${user.lockedUntil.toISOString()}`
      );
    }

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= maxAttempts) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      appendLoginHistory(user, req, false);
      await user.save();
      throw new ApiError(401, "Invalid email or password");
    }

    if (user.status === "blocked") {
      throw new ApiError(403, "User is blocked");
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await setOtpForUser(user, { force: true });
    await audit(req, "login_otp_sent", "auth", { email: user.email }, user._id);

    res.json({
      success: true,
      pendingOtp: true,
      message: "Verification code sent",
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    });
  })
);

router.post(
  "/verify-otp",
  otpRateLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || user.status === "blocked") {
      throw new ApiError(401, "Invalid or expired OTP");
    }

    await verifyOtpForUser(user, req.body.otp);
    user.lastLoginAt = new Date();
    appendLoginHistory(user, req, true);
    await user.save();

    const { accessToken, csrfToken } = await createSession(user, req, res);
    await audit(req, "login", "auth", { email: user.email }, user._id);

    res.json({
      success: true,
      token: accessToken,
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        profilePhoto: user.profilePhoto,
        permissions: normalizePagePermissions(user.permissions, user.role),
        permissionMatrix: toActionPermissions(user.permissions, user.role)
      }
    });
  })
);

router.post(
  "/resend-otp",
  otpRateLimiter,
  validate(resendOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user && user.status === "active") {
      await setOtpForUser(user);
      await audit(req, "login_otp_resent", "auth", { email: user.email }, user._id);
    }

    res.json({
      success: true,
      pendingOtp: true,
      message: "If the account can sign in, a new verification code has been sent",
      maskedEmail: user ? maskEmail(user.email) : "",
      expiresInSeconds: 300,
      resendAfterSeconds: 60
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      throw new ApiError(401, "Refresh token missing");
    }

    const decoded = verifyRefreshToken(token);
    const tokenHash = hashToken(token);

    const session = await SessionToken.findOne({
      user: decoded.sub,
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      throw new ApiError(401, "Invalid refresh token session");
    }

    const user = await User.findById(decoded.sub);
    if (!user || user.status !== "active") {
      throw new ApiError(401, "Invalid user session");
    }

    const payload = buildAuthPayload(user);
    const accessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    session.revokedAt = new Date();
    await session.save();

    await SessionToken.create({
      user: user._id,
      tokenHash: hashToken(newRefreshToken),
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip,
      expiresAt: parseExpiryToDate(env.jwtRefreshExpiresIn)
    });

    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    const csrfToken = issueCsrfToken(res);

    res.json({
      success: true,
      token: accessToken,
      csrfToken
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await SessionToken.updateOne(
        { tokenHash: hashToken(token), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.clearCookie("hse_csrf_token", {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/"
    });
    res.json({ success: true, message: "Logged out" });
  })
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("-password");
    const pagePermissions = normalizePagePermissions(user?.permissions, user?.role);
    res.json({
      success: true,
      user: {
        ...user.toObject(),
        permissions: pagePermissions,
        permissionMatrix: toActionPermissions(pagePermissions, user?.role)
      }
    });
  })
);

module.exports = router;
