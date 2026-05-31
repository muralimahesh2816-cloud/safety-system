const app = require("./app");
const connectDb = require("./config/db");
const { env } = require("./config/env");
const logger = require("./utils/logger");

const startServer = async () => {
  try {
    await connectDb();
    app.listen(env.port, () => {
      logger.info(`Safety HSE API running on port ${env.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      message: error.message
    });
    process.exit(1);
  }
};

startServer();
