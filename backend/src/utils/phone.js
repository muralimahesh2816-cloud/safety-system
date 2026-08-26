const ApiError = require("./api-error");

/**
 * Phone number normalisation.
 *
 * Everything is stored and compared in E.164 (`+919876543210`). The point is
 * that one human being has exactly one stored number no matter how they typed
 * it — `9876543210`, `+91 98765 43210`, `091-9876543210` and `0091 9876543210`
 * must all resolve to the same record, otherwise a unique index is meaningless
 * and OTP login silently fails for a user whose number was saved in a different
 * shape than the one they type.
 *
 * India is the default because that is where this portal operates, but the
 * country table is data: adding a country is one entry, not a code change.
 */

const COUNTRIES = Object.freeze({
  // dialCode: the international prefix, without "+"
  // nsnLength: length of the national significant number
  // firstDigits: valid leading digits for a mobile number in that country
  IN: { dialCode: "91", nsnLength: 10, firstDigits: /^[6-9]/, label: "India" },
  AE: { dialCode: "971", nsnLength: 9, firstDigits: /^5/, label: "United Arab Emirates" },
  GB: { dialCode: "44", nsnLength: 10, firstDigits: /^7/, label: "United Kingdom" },
  US: { dialCode: "1", nsnLength: 10, firstDigits: /^[2-9]/, label: "United States" }
});

const DEFAULT_COUNTRY = "IN";

const stripFormatting = (value = "") => String(value).replace(/[\s()\-.]/g, "");

/**
 * Normalises any reasonable input to E.164.
 *
 * Returns `{ ok: true, e164, country, national }` or `{ ok: false, reason }`.
 * Never throws — this runs on unauthenticated login input.
 */
const normalizePhone = (input, defaultCountry = DEFAULT_COUNTRY) => {
  const country = COUNTRIES[defaultCountry] ? defaultCountry : DEFAULT_COUNTRY;
  const rules = COUNTRIES[country];

  let value = stripFormatting(input);
  if (!value) return { ok: false, reason: "EMPTY" };
  if (!/^\+?\d+$/.test(value)) return { ok: false, reason: "INVALID_CHARACTERS" };

  // "00" is the other way of writing "+" internationally.
  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  if (value.startsWith("+")) {
    const digits = value.slice(1);
    const match = Object.entries(COUNTRIES).find(([, rule]) => digits.startsWith(rule.dialCode));
    if (!match) return { ok: false, reason: "UNSUPPORTED_COUNTRY" };
    const [code, rule] = match;
    const national = digits.slice(rule.dialCode.length);
    return validateNational(national, code, rule);
  }

  // A national trunk prefix ("0" in India) is not part of the number.
  if (value.length === rules.nsnLength + 1 && value.startsWith("0")) {
    value = value.slice(1);
  }

  // Bare digits that already carry the country code, e.g. "919876543210".
  if (value.length === rules.nsnLength + rules.dialCode.length && value.startsWith(rules.dialCode)) {
    value = value.slice(rules.dialCode.length);
  }

  return validateNational(value, country, rules);
};

const validateNational = (national, country, rules) => {
  if (national.length !== rules.nsnLength) return { ok: false, reason: "INVALID_LENGTH" };
  if (!rules.firstDigits.test(national)) return { ok: false, reason: "NOT_A_MOBILE" };
  return {
    ok: true,
    e164: `+${rules.dialCode}${national}`,
    country,
    dialCode: `+${rules.dialCode}`,
    national
  };
};

/** Throwing wrapper for routes that require a valid number. */
const requirePhone = (input, defaultCountry = DEFAULT_COUNTRY) => {
  const result = normalizePhone(input, defaultCountry);
  if (!result.ok) {
    throw new ApiError(400, "Please enter a valid mobile number.", null, `PHONE_${result.reason}`);
  }
  return result;
};

/**
 * `+91 ******3210` — enough for the user to recognise their own number,
 * not enough to disclose someone else's. Used in API responses, audit
 * metadata and log lines; a full number must never appear in any of them.
 */
const maskPhone = (e164 = "") => {
  const value = String(e164 || "");
  if (!value) return "";
  const digits = value.replace(/^\+/, "");
  if (digits.length < 4) return "*".repeat(digits.length);
  const last4 = digits.slice(-4);
  const match = Object.values(COUNTRIES).find((rule) => digits.startsWith(rule.dialCode));
  const dial = match ? `+${match.dialCode} ` : "+";
  return `${dial}${"*".repeat(Math.max(4, digits.length - (match ? match.dialCode.length : 0) - 4))}${last4}`;
};

/** WhatsApp Cloud API wants the number without the leading "+". */
const toWhatsAppRecipient = (e164 = "") => String(e164 || "").replace(/^\+/, "");

module.exports = {
  COUNTRIES,
  DEFAULT_COUNTRY,
  maskPhone,
  normalizePhone,
  requirePhone,
  toWhatsAppRecipient
};
