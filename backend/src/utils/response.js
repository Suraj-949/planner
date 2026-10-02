/*
 * Response envelope.
 *
 * Every success response has the same shape, so a client can branch on `ok` instead of
 * guessing which fields a given endpoint happens to return. Errors are handled separately
 * by the error middleware, which emits `{ ok: false, message, details? }`.
 *
 * The payload is nested under `data` rather than spread at the top level so that adding
 * a field can never collide with `ok`.
 */

const ok = (res, status, data) => res.status(status).json({ ok: true, data });

const created = (res, data) => ok(res, 201, data);

module.exports = { ok, created };
