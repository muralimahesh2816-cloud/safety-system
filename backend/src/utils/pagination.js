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

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  getPagination,
  buildPaginationMeta,
  hasPagination,
  escapeRegex
};
