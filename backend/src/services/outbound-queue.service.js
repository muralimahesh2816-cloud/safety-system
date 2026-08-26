const OutboundMessage = require("../models/OutboundMessage");
const logger = require("../utils/logger");
const { sendMessage, getProviderName } = require("./whatsapp.service");

/**
 * Delivery queue for outbound WhatsApp messages.
 *
 * Why a queue at all: submitting a work approval must not wait on Meta's API.
 * A safety officer on a site tablet should get their response as soon as the
 * assignment is stored; whether a WhatsApp message left the building three
 * seconds later is not something they should be made to wait for. So the
 * request path only ever does one indexed insert (`enqueue`), and delivery
 * happens on a worker afterwards.
 *
 * Why the database is the queue: this deployment has MongoDB and nothing else.
 * Introducing Redis/BullMQ for a message every few minutes would be
 * infrastructure the customer has to run, monitor and pay for. A claimed-row
 * pattern over an indexed collection is durable across restarts, survives a
 * crash mid-send, and is inspectable with the tools the team already has.
 *
 * Retry uses exponential backoff expressed as `nextAttemptAt`, so a restart
 * neither loses pending work nor re-fires everything at once. Attempts are
 * bounded — a permanently bad number must end as a visible `failed` row, not
 * an infinite loop.
 */

const POLL_INTERVAL_MS = 15000;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
// 1 min, then 5, then 15.
const BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

let timer = null;
let draining = false;

/**
 * Records a message to be delivered. Returns immediately after one insert;
 * the caller is on the request path and must not be delayed further.
 */
const enqueue = async ({
  recipient,
  recipientPhone,
  recipientName = "",
  event,
  body,
  relatedModule = "",
  relatedRecordId = null,
  notification = null,
  templateName = "",
  templateVariables = []
}) => {
  if (!recipient || !recipientPhone) return null;
  try {
    return await OutboundMessage.create({
      channel: "whatsapp",
      recipient,
      recipientPhone,
      recipientName,
      event,
      body,
      relatedModule,
      relatedRecordId,
      notification,
      templateName,
      templateVariables,
      provider: getProviderName(),
      status: "pending",
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: new Date()
    });
  } catch (error) {
    // Never let a notification bookkeeping failure break the business
    // operation that triggered it.
    logger.warn("Could not queue outbound message", { event, message: error.message });
    return null;
  }
};

/**
 * Claims one due message atomically.
 *
 * `findOneAndUpdate` with the status in the filter is what makes this safe when
 * more than one server process is running: exactly one of them transitions a
 * row from `pending` to `sending`, so a message cannot be delivered twice.
 */
const claimNext = async () =>
  OutboundMessage.findOneAndUpdate(
    { status: { $in: ["pending"] }, nextAttemptAt: { $lte: new Date() } },
    { $set: { status: "sending", lastAttemptAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" }
  );

const settle = async (message, result) => {
  if (result.ok) {
    message.status = result.skipped ? "skipped" : "sent";
    message.providerMessageId = result.providerMessageId || "";
    message.sentAt = new Date();
    message.failureReason = "";
    message.provider = result.provider || message.provider;
    await message.save();
    return;
  }

  const exhausted = message.attempts >= (message.maxAttempts || MAX_ATTEMPTS);
  const givingUp = exhausted || result.retriable === false;

  message.status = givingUp ? "failed" : "pending";
  message.failureReason = String(result.error || "Unknown delivery failure").slice(0, 500);
  message.provider = result.provider || message.provider;
  if (!givingUp) {
    const delay = BACKOFF_MS[Math.min(message.attempts - 1, BACKOFF_MS.length - 1)];
    message.nextAttemptAt = new Date(Date.now() + delay);
  }
  await message.save();

  logger[givingUp ? "warn" : "info"](
    givingUp ? "Outbound message failed permanently" : "Outbound message will be retried",
    {
      id: String(message._id),
      event: message.event,
      attempts: message.attempts,
      reason: message.failureReason
    }
  );
};

/** Processes everything currently due. Safe to call at any time. */
const drain = async () => {
  if (draining) return 0;
  draining = true;
  let processed = 0;
  try {
    for (let i = 0; i < BATCH_SIZE; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const message = await claimNext();
      if (!message) break;
      // eslint-disable-next-line no-await-in-loop
      const result = await sendMessage({
        to: message.recipientPhone,
        body: message.body,
        event: message.event,
        templateName: message.templateName,
        templateVariables: message.templateVariables
      });
      // eslint-disable-next-line no-await-in-loop
      await settle(message, result);
      processed += 1;
    }
  } catch (error) {
    logger.warn("Outbound queue drain failed", { message: error.message });
  } finally {
    draining = false;
  }
  return processed;
};

const start = () => {
  if (timer) return;
  timer = setInterval(() => {
    drain().catch(() => {});
  }, POLL_INTERVAL_MS);
  // Do not hold the process open on shutdown for the sake of a poll timer.
  if (typeof timer.unref === "function") timer.unref();
  logger.info("Outbound notification queue started", {
    provider: getProviderName(),
    intervalMs: POLL_INTERVAL_MS
  });
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

module.exports = {
  BACKOFF_MS,
  MAX_ATTEMPTS,
  drain,
  enqueue,
  start,
  stop
};
