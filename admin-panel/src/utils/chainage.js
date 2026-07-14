export const getChainageFrom = (work = {}) =>
  String(work.chainageFrom || work.chainage || work.chainageNo || "").trim();

export const getChainageTo = (work = {}) =>
  String(work.chainageTo || work.chainageFrom || work.chainage || work.chainageNo || "").trim();

export const parseComparableChainage = (value = "") => {
  const cleaned = String(value)
    .trim()
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

export const validateChainageRange = ({ chainageFrom = "", chainageTo = "" }) => {
  const from = String(chainageFrom || "").trim();
  const to = String(chainageTo || "").trim();
  const errors = { chainageFrom: "", chainageTo: "" };

  if (!from) errors.chainageFrom = "Chainage From is required.";
  if (!to) errors.chainageTo = "Chainage To is required.";

  const fromNumber = parseComparableChainage(from);
  const toNumber = parseComparableChainage(to);
  if (!errors.chainageFrom && !errors.chainageTo && fromNumber !== null && toNumber !== null && toNumber < fromNumber) {
    errors.chainageTo = "Chainage To cannot be less than Chainage From.";
  }

  return {
    isValid: !errors.chainageFrom && !errors.chainageTo,
    errors,
    values: { chainageFrom: from, chainageTo: to }
  };
};

export const formatChainageRange = (work = {}, compact = false) => {
  const from = getChainageFrom(work);
  const to = getChainageTo(work);

  if (!from && !to) return "-";
  if (from && to && from !== to) return compact ? `${from} \u2192 ${to}` : `${from} to ${to}`;
  return from || to;
};

export const matchesChainageSearch = (work = {}, query = "") => {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return [getChainageFrom(work), getChainageTo(work), work.chainageNo, work.chainage]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
};
