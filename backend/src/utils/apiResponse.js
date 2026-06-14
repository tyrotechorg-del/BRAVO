/**
 * Standardised API response helpers.
 *
 * The original codebase has each controller hand-rolling response shapes —
 * sometimes `{ error: ... }`, sometimes `{ message: ... }`, sometimes just
 * raw data, sometimes wrapped. This makes the frontend brittle.
 *
 * These helpers don't replace what's already there (controllers can still
 * call res.json directly), but new code should prefer these.
 */

/**
 * Success response.
 * @param {Response} res - Express response object
 * @param {*} data - Payload (anything JSON-serialisable)
 * @param {string} [message] - Optional human-readable message
 * @param {number} [status=200] - HTTP status code
 */
export const success = (res, data, message, status = 200) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

/**
 * Paginated success response. Shape matches what existing controllers
 * already return (page/totalPages/total) so the frontend doesn't change.
 */
export const paginated = (res, items, { page, limit, total }) => {
  return res.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
};

/**
 * Error response. Use sparingly — in most cases, throwing an error and
 * letting the central errorHandler middleware format it is cleaner.
 */
export const error = (res, message, status = 500, details) => {
  const body = { success: false, error: message };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  return res.status(status).json(body);
};

/**
 * Parse and clamp pagination params from req.query.
 * Returns sane defaults if missing/invalid.
 *
 *   const { page, limit, skip } = parsePagination(req.query);
 *
 * Use in any controller that takes `?page=...&limit=...` — this is the
 * single source of truth so we don't have 18 controllers each doing it
 * slightly differently (some forget to cap `limit`, some forget to coerce
 * to int, some divide by zero...).
 */
export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
