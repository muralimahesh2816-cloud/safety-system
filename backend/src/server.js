const app = require("./app");
const connectDb = require("./config/db");
const { env } = require("./config/env");
const logger = require("./utils/logger");
const { startHseGovernanceScheduler } = require("./services/hse-governance.service");
const { start: startOutboundQueue } = require("./services/outbound-queue.service");

const startServer = async () => {
  try {
    await connectDb();
    startHseGovernanceScheduler();
    // Started after the database is up: the queue's storage IS the database,
    // so there is nothing for it to drain before then.
    startOutboundQueue();
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
