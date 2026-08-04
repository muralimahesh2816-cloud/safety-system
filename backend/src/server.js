const app = require("./app");
const connectDb = require("./config/db");
const { env } = require("./config/env");
const logger = require("./utils/logger");
const { startHseGovernanceScheduler } = require("./services/hse-governance.service");

const startServer = async () => {
  try {
    await connectDb();
    startHseGovernanceScheduler();
    app.listen(env.port, () => {
      logger.info(`${env.appName} API running on port ${env.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      message: error.message
    });
    process.exit(1);
  }
};

startServer();
