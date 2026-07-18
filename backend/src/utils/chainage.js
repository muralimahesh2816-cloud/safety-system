const cleanChainage = (value = "") => String(value || "").trim();

const getRequestedChainageFrom = (work = {}) =>
  cleanChainage(
    work.requestedChainageFrom ||
      work.chainageFrom ||
      work.chainage ||
      work.chainageNo ||
      ""
  );

const getRequestedChainageTo = (work = {}) =>
  cleanChainage(
    work.requestedChainageTo ||
      work.chainageTo ||
      work.requestedChainageFrom ||
      work.chainageFrom ||
      work.chainage ||
      work.chainageNo ||
      ""
  );

// Legacy aliases remain available while existing routes and records are migrated.
const getChainageFrom = getRequestedChainageFrom;
const getChainageTo = getRequestedChainageTo;

const getApprovedChainageFrom = (work = {}) =>
  cleanChainage(work.approvedChainageFrom || work.approvedChainage?.from || "");

const getApprovedChainageTo = (work = {}) =>
  cleanChainage(work.approvedChainageTo || work.approvedChainage?.to || "");

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

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;

  // Six-digit road chainage values such as 328500 mean KM 328+500.
  return Number.isInteger(numeric) && numeric >= 10000 ? numeric / 1000 : numeric;
};

const normalizeChainagePayload = (payload = {}) => {
  const requestedChainageFrom = getRequestedChainageFrom(payload);
  const requestedChainageTo = getRequestedChainageTo(payload);

  return {
    requestedChainageFrom,
    requestedChainageTo
  };
};

const validateChainageRange = (payload = {}) => {
  const {
    requestedChainageFrom: chainageFrom,
    requestedChainageTo: chainageTo
  } = normalizeChainagePayload(payload);
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
  getApprovedChainageFrom,
  getApprovedChainageTo,
  getChainageFrom,
  getChainageTo,
  getRequestedChainageFrom,
  getRequestedChainageTo,
  normalizeChainagePayload,
  parseComparableChainage,
  validateChainageRange,
  formatChainageRange
};
