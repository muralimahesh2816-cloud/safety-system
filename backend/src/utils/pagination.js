const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPagination = (query = {}, { defaultLimit = 50, maxLimit = 200 } = {}) => {
  const page = clamp(Number.parseInt(query.page, 10) || 1, 1, 100000);
  const limit = clamp(Number.parseInt(query.limit, 10) || defaultLimit, 1, maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1
});

const hasPagination = (query = {}) => query.page !== undefined || query.limit !== undefined;

/**
 * Ceiling applied to list endpoints that a client called without any
 * pagination parameters.
 *
 * Those endpoints previously returned the entire collection. For hazards and
 * training — whose documents carry embedded media arrays and per-user
 * completion history — that meant a response that grows without bound as the
 * site accumulates records, which is what made those pages progressively
 * slower to open. Older clients keep working (they still get a single
 * response); they just cannot pull down an unbounded one. Responses report
 * `capped: true` when the cap actually truncated the result, so a caller can
 * tell the difference between "that is everything" and "ask for page 2".
 */
const UNPAGINATED_MAX = 500;

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  getPagination,
  buildPaginationMeta,
  hasPagination,
  escapeRegex,
  UNPAGINATED_MAX
};
