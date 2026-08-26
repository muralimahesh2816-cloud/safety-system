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
  otpSchema,
  resendOtpSchema,
  mobileOtpRequestSchema,
  mobileOtpVerifySchema
} = require("../validators/auth.validators");
const { maskPhone, requirePhone } = require("../utils/phone");
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
const { authRateLimiter, otpRequestRateLimiter } = require("../middleware/rateLimit.middleware");
const { setOtpForUser, verifyOtpForUser } = require("../services/auth.service");

const router = express.Router();

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  ...(isProduction ? { partitioned: true } : {})
};

const buildAuthPayload = (user) => ({
  sub: user._id.toString(),
  role: user.role,
  email: user.email,
  name: user.name
});

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  status: user.status,
  profilePhoto: user.profilePhoto,
  permissions: normalizePagePermissions(user.permissions, user.role),
  permissionMatrix: toActionPermissions(user.permissions, user.role)
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
      throw new ApiError(403, "Only admins can create users", null, "PERMISSION_DENIED");
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
  authRateLimiter,
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
      throw new ApiError(403, "User is blocked", null, "USER_BLOCKED");
    }

    const requiresOtp = Boolean(
      env.enforceOtpAuth ||
        user.isTwoFactorEnabled ||
        settings?.security?.twoFactorAuthentication
    );

    if (requiresOtp) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.loginLockedUntil = null;
      await user.save();

      const otpResponse = await setOtpForUser(user, { force: true });
      await audit(req, "otp_sent", "auth", { email: user.email }, user._id);
      res.json({
        success: true,
        ...otpResponse,
        email: user.email
      });
      return;
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.otpHash = "";
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.loginLockedUntil = null;
    user.otpVerified = false;
    appendLoginHistory(user, req, true);
    await user.save();

    const { accessToken, csrfToken } = await createSession(user, req, res);
    await audit(req, "login", "auth", { email: user.email }, user._id);

    res.json({
      success: true,
      token: accessToken,
      csrfToken,
      user: buildUserResponse(user)
    });
  })
);

router.post(
  "/verify-otp",
  authRateLimiter,
  validate(otpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      throw new ApiError(401, "Invalid or expired OTP");
    }

    await verifyOtpForUser(user, req.body.otp);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    appendLoginHistory(user, req, true);
    await user.save();

    const { accessToken, csrfToken } = await createSession(user, req, res);
    await audit(req, "otp_verification", "auth", { email: user.email }, user._id);
    await audit(req, "login", "auth", { email: user.email, otpVerified: true }, user._id);

    res.json({
      success: true,
      token: accessToken,
      csrfToken,
      user: buildUserResponse(user)
    });
  })
);

router.post(
  "/resend-otp",
  authRateLimiter,
  validate(resendOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || user.status !== "active") {
      throw new ApiError(401, "Unable to resend OTP for this account");
    }

    const otpResponse = await setOtpForUser(user);
    await audit(req, "otp_resend", "auth", { email: user.email }, user._id);
    res.json({
      success: true,
      ...otpResponse,
      email: user.email
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
    let session = null;
    if (token) {
      session = await SessionToken.findOne({
        tokenHash: hashToken(token),
        revokedAt: null
      }).select("user");
      await SessionToken.updateOne(
        { tokenHash: hashToken(token), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.clearCookie("hse_csrf_token", {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      ...(isProduction ? { partitioned: true } : {})
    });
    if (session?.user) {
      await audit(req, "logout", "auth", { tokenRevoked: true }, session.user);
    }
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

/* ------------------------------------------------- mobile number + OTP ---- */

/**
 * Resolves a typed mobile number to a user.
 *
 * Matches on the normalised E.164 form first — that is the indexed, unique
 * identity. The legacy free-text `mobile` field is checked as a fallback so
 * users who were created before normalisation existed can still sign in
 * without an administrator having to touch their record first; when one is
 * found that way, the normalised value is backfilled so the next sign-in takes
 * the fast path.
 */
const findUserByMobile = async (e164, national) => {
  const byNormalised = await User.findOne({ mobileNumber: e164 });
  if (byNormalised) return byNormalised;

  // Only shapes a human plausibly typed into the old free-text field.
  const legacy = await User.findOne({
    mobileNumber: { $in: [null, ""] },
    mobile: { $in: [e164, national, `0${national}`, e164.replace("+", "")] }
  });
  if (legacy) {
    legacy.mobileNumber = e164;
    await legacy.save().catch(() => {});
  }
  return legacy;
};

/**
 * Step 1 — send a one-time code to a registered mobile number.
 *
 * The response is deliberately uniform whether or not the number exists in
 * terms of *timing and shape*, but it does tell an unregistered caller that the
 * number is not registered. That is a considered trade-off: this is a closed
 * corporate portal where accounts are created by an administrator, so the
 * enumeration risk is low, and a silent "code sent" for a number that will
 * never receive one is a support call every time somebody mistypes a digit.
 */
router.post(
  "/otp/request",
  authRateLimiter,
  otpRequestRateLimiter,
  validate(mobileOtpRequestSchema),
  asyncHandler(async (req, res) => {
    const phone = requirePhone(req.body.mobile);
    const user = await findUserByMobile(phone.e164, phone.national);

    if (!user) {
      await audit(req, "otp_request_unknown_mobile", "auth", { mobile: maskPhone(phone.e164) }, null);
      throw new ApiError(
        404,
        "This mobile number is not registered. Please contact your Safety Management System administrator.",
        null,
        "MOBILE_NOT_REGISTERED"
      );
    }

    // An account that cannot sign in must not receive a code either — sending
    // one would tell a blocked user their number is still live and give them
    // something to brute-force against.
    if (user.status !== "active") {
      await audit(req, "otp_request_blocked_account", "auth", { mobile: maskPhone(phone.e164) }, user._id);
      throw new ApiError(
        403,
        "Your account is inactive. Please contact your Safety Management System administrator.",
        null,
        "USER_BLOCKED"
      );
    }

    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      throw new ApiError(423, "Too many attempts. Please try again later.", null, "LOGIN_LOCKED");
    }

    const otpResponse = await setOtpForUser(user, { channel: "whatsapp" });
    await audit(
      req,
      "otp_requested",
      "auth",
      { mobile: maskPhone(phone.e164), deliveredVia: otpResponse.deliveredVia },
      user._id
    );

    res.json({
      success: true,
      pendingOtp: true,
      expiresInSeconds: otpResponse.expiresInSeconds,
      resendAfterSeconds: otpResponse.resendAfterSeconds,
      maskedMobile: otpResponse.maskedMobile || maskPhone(phone.e164),
      deliveredVia: otpResponse.deliveredVia
    });
  })
);

/**
 * Step 2 — verify the code and issue the normal session.
 *
 * Deliberately reuses `verifyOtpForUser` and `createSession`: the same attempt
 * counting, the same lockout, the same JWT + refresh-token + CSRF issuance as
 * every other way into this system. Mobile OTP is a new front door, not a
 * second security model.
 */
router.post(
  "/otp/verify",
  // Per-IP only. The send-budget limiter deliberately does not apply here:
  // mistyping a code twice must not consume a user's ability to request one,
  // and brute force on this endpoint is already bounded per account by
  // verifyOtpForUser's attempt counter and 15-minute lockout.
  authRateLimiter,
  validate(mobileOtpVerifySchema),
  asyncHandler(async (req, res) => {
    const phone = requirePhone(req.body.mobile);
    const user = await findUserByMobile(phone.e164, phone.national);

    if (!user || user.status !== "active") {
      // No distinction here — at the verify step, telling a caller whether the
      // number exists would hand them an oracle the request step's rate limit
      // is meant to protect.
      throw new ApiError(401, "The OTP is incorrect. Please try again.", null, "OTP_INVALID");
    }

    try {
      await verifyOtpForUser(user, req.body.otp);
    } catch (error) {
      await audit(req, "otp_failed", "auth", { mobile: maskPhone(phone.e164) }, user._id);
      throw error;
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.mobileVerifiedAt = new Date();
    if (!user.mobileNumber) user.mobileNumber = phone.e164;
    appendLoginHistory(user, req, true);
    await user.save();

    const { accessToken, csrfToken } = await createSession(user, req, res);
    await audit(req, "otp_verification", "auth", { mobile: maskPhone(phone.e164) }, user._id);
    await audit(req, "login", "auth", { mobile: maskPhone(phone.e164), method: "mobile_otp" }, user._id);

    res.json({
      success: true,
      token: accessToken,
      csrfToken,
      user: buildUserResponse(user)
    });
  })
);

module.exports = router;
