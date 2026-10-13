/*
 * Response envelope.
 *
 * Every success response has the same shape, so a client can branch on `ok` instead of
 * guessing which fields a given endpoint happens to return. Errors are handled separately
 * by the error middleware, which emits `{ ok: false, code, message, details? }`.
 *
 * The payload is nested under `data` rather than spread at the top level so that adding
 * a field can never collide with `ok`.
 */

const ok = (res, status, data) => res.status(status).json({ ok: true, data });

const created = (res, data) => ok(res, 201, data);

const ERROR_CODES = {
    400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
    404: 'NOT_FOUND', 413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED',
};

const errorBody = (status, message, code, details) => ({
    ok: false,
    code: code || ERROR_CODES[status] || 'INTERNAL_ERROR',
    message,
    ...(details ? { details } : {}),
});
const fail = (res, status, message, code, details) =>
    res.status(status).json(errorBody(status, message, code, details));

module.exports = { ok, created, fail, errorBody };
