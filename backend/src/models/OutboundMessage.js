const mongoose = require("mongoose");

/**
 * One outbound message on an external channel (currently WhatsApp), with its
 * full delivery lifecycle.
 *
 * This exists as its own collection rather than as fields on Notification
 * because delivery is a different concern from the in-app notification: an
 * assignment produces exactly one in-app notification but may produce several
 * delivery attempts, may fail and retry, and may need to be inspected long
 * after the notification has been read. Keeping it separate also means an
 * external-provider outage cannot corrupt or block the in-app record, which is
 * the one the portal actually depends on.
 *
 * Nothing here stores credentials — only the provider's own message id, which
 * is what support needs to trace a message with the provider.
 */
const outboundMessageSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp", index: true },

    // Who it went to. `recipientPhone` is E.164; it is deliberately NOT indexed
    // for lookup by number — support traces by user or by providerMessageId.
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientPhone: { type: String, required: true },
    recipientName: { type: String, default: "" },

    // What it was about, so a failed delivery can be tied back to the record
    // that triggered it.
    event: { type: String, required: true },
    relatedModule: { type: String, default: "" },
    relatedRecordId: { type: mongoose.Schema.Types.ObjectId, default: null },
    notification: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", default: null },

    // The rendered body. Retained so support can see exactly what a worker
    // received, and so a retry re-sends the same text rather than re-rendering
    // from a record that may have changed in the meantime.
    body: { type: String, default: "" },
    templateName: { type: String, default: "" },
    templateVariables: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "skipped"],
      default: "pending",
      index: true
    },
    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    // When the queue may next pick this up. Backoff is expressed as a time, not
    // a sleep, so a restart does not lose or immediately re-fire pending work.
    nextAttemptAt: { type: Date, default: Date.now },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failureReason: { type: String, default: "" }
  },
  { timestamps: true }
);

// The queue's claim query: everything due, oldest first.
outboundMessageSchema.index({ status: 1, nextAttemptAt: 1 });
// Delivery history for one record ("was the checker actually told?").
outboundMessageSchema.index({ relatedModule: 1, relatedRecordId: 1, createdAt: -1 });
// Support lookup by the provider's own id.
outboundMessageSchema.index({ providerMessageId: 1 }, { sparse: true });

module.exports = mongoose.model("OutboundMessage", outboundMessageSchema);
