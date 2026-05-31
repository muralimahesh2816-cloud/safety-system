const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn
  });

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const parseExpiryToDate = (expiry) => {
  const now = Date.now();
  if (expiry.endsWith("d")) {
    return new Date(now + Number(expiry.slice(0, -1)) * 24 * 60 * 60 * 1000);
  }
  if (expiry.endsWith("h")) {
    return new Date(now + Number(expiry.slice(0, -1)) * 60 * 60 * 1000);
  }
  if (expiry.endsWith("m")) {
    return new Date(now + Number(expiry.slice(0, -1)) * 60 * 1000);
  }
  return new Date(now + 7 * 24 * 60 * 60 * 1000);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  parseExpiryToDate
};
