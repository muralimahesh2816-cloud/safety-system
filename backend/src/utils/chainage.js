const cleanChainage = (value = "") => String(value || "").trim();

const getChainageFrom = (work = {}) =>
  cleanChainage(work.chainageFrom || work.chainage || work.chainageNo || "");

const getChainageTo = (work = {}) =>
  cleanChainage(work.chainageTo || work.chainageFrom || work.chainage || work.chainageNo || "");

const parseComparableChainage = (value = "") => {
  const cleaned = cleanChainage(value)
    .toUpperCase()
    .replace(/^KM\s*/i, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  const plusMatch = cleaned.match(/^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/);
  if (plusMatch) {
    return Number(plusMatch[1]) + Number(plusMatch[2]) / 1000;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeChainagePayload = (payload = {}) => {
  const chainageFrom = cleanChainage(payload.chainageFrom || payload.chainage || payload.chainageNo || "");
  const chainageTo = cleanChainage(payload.chainageTo || "");

  return {
    chainageFrom,
    chainageTo,
    chainage: cleanChainage(payload.chainage || chainageFrom),
    chainageNo: cleanChainage(payload.chainageNo || chainageFrom)
  };
};

const validateChainageRange = (payload = {}) => {
  const { chainageFrom, chainageTo } = normalizeChainagePayload(payload);
  if (!chainageFrom) return { valid: false, field: "chainageFrom", message: "Chainage From is required." };
  if (!chainageTo) return { valid: false, field: "chainageTo", message: "Chainage To is required." };

  const fromNumber = parseComparableChainage(chainageFrom);
  const toNumber = parseComparableChainage(chainageTo);
  if (fromNumber !== null && toNumber !== null && toNumber < fromNumber) {
    return {
      valid: false,
      field: "chainageTo",
      message: "Chainage To cannot be less than Chainage From."
    };
  }

  return { valid: true, chainageFrom, chainageTo };
};

const formatChainageRange = (work = {}, compact = false) => {
  const from = getChainageFrom(work);
  const to = getChainageTo(work);
  if (!from && !to) return "";
  if (from && to && from !== to) return compact ? `${from} -> ${to}` : `${from} to ${to}`;
  return from || to;
};

module.exports = {
  cleanChainage,
  getChainageFrom,
  getChainageTo,
  normalizeChainagePayload,
  parseComparableChainage,
  validateChainageRange,
  formatChainageRange
};
