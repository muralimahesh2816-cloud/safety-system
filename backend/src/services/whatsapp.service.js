const { env } = require("../config/env");
const logger = require("../utils/logger");
const { toWhatsAppRecipient } = require("../utils/phone");

/**
 * WhatsApp transport.
 *
 * Provider-agnostic on purpose: the rest of the application calls `sendMessage`
 * and never learns which provider is behind it. Swapping Meta for another
 * approved corporate gateway is a new `PROVIDERS` entry, not a change to any
 * caller.
 *
 * Only official business APIs are supported. Browser automation, unofficial
 * bridges and personal-account bots are deliberately not implemented: they
 * violate WhatsApp's terms and are not something a safety system's audit trail
 * should depend on.
 *
 * Returns a normalised result — `{ ok, providerMessageId, error, retriable }` —
 * so the queue can make retry decisions without knowing provider specifics.
 * It never throws: a transport failure is data, not an exception, because the
 * caller is a background worker whose job is to record the outcome.
 */

const RETRIABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 10000;

/**
 * `log` provider — the default.
 *
 * Not a stub that pretends to succeed: it records the message and reports a
 * distinct `skipped` outcome, so a developer or a test can see exactly what
 * *would* have been sent, and nobody mistakes an unconfigured environment for a
 * working one.
 */
const logProvider = {
  name: "log",
  send: async ({ to, body, event }) => {
    logger.info("WhatsApp delivery skipped (provider not configured)", {
      event,
      // Never the full number, even in a local log line.
      to: `***${String(to).slice(-4)}`,
      preview: String(body).slice(0, 80)
    });
    return { ok: true, skipped: true, providerMessageId: "" };
  }
};

/** Meta WhatsApp Business Cloud API. */
const metaProvider = {
  name: "meta",
  send: async ({ to, body, templateName, templateVariables }) => {
    const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;

    // Business-initiated conversations require an approved template. Where one
    // is configured we use it; otherwise we send a plain text message, which
    // Meta only delivers inside an open 24-hour customer service window. Both
    // shapes are supported because which applies depends on the customer's
    // WhatsApp Business setup, not on anything this code can decide.
    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to: toWhatsAppRecipient(to),
          type: "template",
          template: {
            name: templateName,
            language: { code: env.whatsapp.templateLanguage },
            components: templateVariables?.length
              ? [
                  {
                    type: "body",
                    parameters: templateVariables.map((text) => ({ type: "text", text: String(text) }))
                  }
                ]
              : []
          }
        }
      : {
          messaging_product: "whatsapp",
          to: toWhatsAppRecipient(to),
          type: "text",
          text: { preview_url: false, body }
        };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsapp.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          // 4xx other than throttling means the request itself is wrong —
          // retrying an unapproved template or an invalid number just burns
          // attempts and delays the eventual failure being visible.
          retriable: RETRIABLE_HTTP.has(response.status),
          error: data?.error?.message || `WhatsApp API returned ${response.status}`
        };
      }

      return { ok: true, providerMessageId: data?.messages?.[0]?.id || "" };
    } catch (error) {
      // Network failure, DNS, or our own timeout — all worth retrying.
      return {
        ok: false,
        retriable: true,
        error: error.name === "AbortError" ? "WhatsApp API request timed out" : error.message
      };
    } finally {
      clearTimeout(timeout);
    }
  }
};

const PROVIDERS = {
  log: logProvider,
  meta: metaProvider
};

const getProvider = () => {
  if (!env.whatsapp.enabled) return logProvider;
  return PROVIDERS[env.whatsapp.provider] || logProvider;
};

const isConfigured = () => env.whatsapp.enabled && getProvider().name !== "log";

/**
 * Sends one message. `to` must already be E.164.
 * Never throws — see the module comment.
 */
const sendMessage = async ({ to, body, event = "message", templateName = "", templateVariables = [] }) => {
  const provider = getProvider();
  if (!to) return { ok: false, retriable: false, error: "No mobile number on file", provider: provider.name };

  try {
    const result = await provider.send({ to, body, event, templateName, templateVariables });
    return { ...result, provider: provider.name };
  } catch (error) {
    logger.warn("WhatsApp provider threw unexpectedly", { provider: provider.name, message: error.message });
    return { ok: false, retriable: true, error: error.message, provider: provider.name };
  }
};

module.exports = {
  getProviderName: () => getProvider().name,
  isConfigured,
  sendMessage
};
