const mongoose = require("mongoose");
const { env } = require("./env");
const logger = require("../utils/logger");

const parseMongoAuthInfo = (uri = "") => {
  try {
    const cleanUri = uri.trim();
    if (!cleanUri.startsWith("mongodb+srv://")) return {};
    const afterProtocol = cleanUri.slice("mongodb+srv://".length);
    const atIndex = afterProtocol.lastIndexOf("@");
    if (atIndex < 0) return {};
    const creds = afterProtocol.slice(0, atIndex);
    const hostAndPath = afterProtocol.slice(atIndex + 1);
    const colonIndex = creds.indexOf(":");
    const username = colonIndex >= 0 ? creds.slice(0, colonIndex) : creds;
    const host = hostAndPath.split("/")[0] || "";
    const dbPath = hostAndPath.split("/")[1] || "";
    return {
      username,
      host,
      hasDatabasePath: Boolean(dbPath && !dbPath.startsWith("?"))
    };
  } catch (_error) {
    return {};
  }
};

const connectDb = async () => {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.mongoUri);
    logger.database("info", "MongoDB connected");
  } catch (error) {
    const authInfo = parseMongoAuthInfo(env.mongoUri);
    if ((error?.message || "").toLowerCase().includes("bad auth")) {
      logger.database("error", "MongoDB authentication failed", {
        host: authInfo.host || "unknown",
        username: authInfo.username || "unknown",
        hasDatabasePath: authInfo.hasDatabasePath,
        hint: "Verify Atlas Database Access user/password. If password has reserved URI chars, URL-encode it."
      });
      throw new Error(
        "MongoDB authentication failed. Check Atlas DB user credentials and URL-encoding in MONGODB_URI."
      );
    }
    throw error;
  }
};

module.exports = connectDb;
