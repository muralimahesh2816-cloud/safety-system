export const normalizeWorkStage = (work = {}) => {
  const raw = typeof work === "string" ? work : work.workflowStage || work.status || "";
  const legacy = {
    Pending: "Pending Check",
    "Under Review": "Pending Check",
    "Pending Approval": "Pending Final Approval",
    "Final Approved": "Approved",
    Rejected: "Returned for Correction",
    COMPLETED: "Completed",
    complete: "Completed",
    "Work Completed": "Completed",
    "Final Completed": "Completed"
  };
  return legacy[raw] || raw || "Pending Check";
};

export const isPostApprovalStage = (work = {}) =>
  ["Approved", "Work In Progress", "Partially Completed", "Completed"].includes(
    normalizeWorkStage(work)
  );

export const getRequestedChainageFrom = (work = {}) =>
  String(
    work.requestedChainageFrom ||
      work.chainageFrom ||
      work["Chainage From"] ||
      work["Chainage"] ||
      work.chainage ||
      work.chainageNo ||
      ""
  ).trim();

export const getRequestedChainageTo = (work = {}) =>
  String(
    work.requestedChainageTo ||
      work.chainageTo ||
      work["Chainage To"] ||
      work.requestedChainageFrom ||
      work.chainageFrom ||
      work["Chainage From"] ||
      work["Chainage"] ||
      work.chainage ||
      work.chainageNo ||
      ""
  ).trim();

export const getChainageFrom = getRequestedChainageFrom;
export const getChainageTo = getRequestedChainageTo;

export const getApprovedChainageFrom = (work = {}) =>
  isPostApprovalStage(work)
    ? String(
        work.approvedChainageFrom ||
          work.approvedChainage?.from ||
          getRequestedChainageFrom(work) ||
          ""
      ).trim()
    : "";

export const getApprovedChainageTo = (work = {}) =>
  isPostApprovalStage(work)
    ? String(
        work.approvedChainageTo ||
          work.approvedChainage?.to ||
          getRequestedChainageTo(work) ||
          ""
      ).trim()
    : "";

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

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  return Number.isInteger(numeric) && numeric >= 10000 ? numeric / 1000 : numeric;
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

export const getChainageDisplay = (work = {}, compact = false) => {
  const approved = isPostApprovalStage(work);
  const from = approved ? getApprovedChainageFrom(work) : getRequestedChainageFrom(work);
  const to = approved ? getApprovedChainageTo(work) : getRequestedChainageTo(work);
  const range = from && to && from !== to
    ? compact
      ? `${from} \u2192 ${to}`
      : `${from} to ${to}`
    : from || to || "-";
  return {
    label: approved ? "Approved Chainage" : "Requested Chainage",
    from,
    to,
    range
  };
};

export const calculateCompletionPercentage = (work = {}) => {
  const stored = Number(work.completionPercentage ?? work.completion?.completionPercentage);
  if (Number.isFinite(stored) && stored > 0) return Math.min(100, Math.round(stored));

  const approvedFrom = parseComparableChainage(getApprovedChainageFrom(work));
  const approvedTo = parseComparableChainage(getApprovedChainageTo(work));
  const completedFrom = parseComparableChainage(
    work.completedChainageFrom || work.completion?.completedChainageFrom
  );
  const completedTo = parseComparableChainage(
    work.completedChainageTo || work.completion?.completedChainageTo
  );
  if ([approvedFrom, approvedTo, completedFrom, completedTo].some((value) => value === null)) {
    return normalizeWorkStage(work) === "Completed" ? 100 : 0;
  }
  const approvedLength = approvedTo - approvedFrom;
  if (approvedLength === 0) return completedFrom === approvedFrom && completedTo === approvedTo ? 100 : 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((completedTo - completedFrom) / approvedLength) * 100))
  );
};

export const matchesChainageSearch = (work = {}, query = "") => {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return [
    getChainageFrom(work),
    getChainageTo(work),
    work.requestedChainageFrom,
    work.requestedChainageTo,
    work.chainageNo,
    work.chainage,
    work["Chainage From"],
    work["Chainage To"],
    work["Chainage"]
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
};
