/*
 * Response envelope.
 *
 * Every success response has the same shape, so a client can branch on `ok` instead of
 * guessing which fields a given endpoint happens to return.
 *
 * Errors go through `errorResponse`, which is the single place the error shape is built.
 * It previously was not: the duplicate-key, validation and cast branches in the error
 * middleware returned a bare `{ message }` while everything else returned
 * `{ ok: false, message }`, so a client had to check for both.
 *
 * The payload is nested under `data` rather than spread at the top level so that adding
 * a field can never collide with `ok`.
 */

const ok = (res, status, data) => res.status(status).json({ ok: true, data });

const created = (res, data) => ok(res, 201, data);

/*
 * Uniform error body: `{ ok: false, message, code, details? }`.
 *
 * `code` is stable and machine-readable; `message` is for humans and may be reworded.
 * A client that switches on the message breaks the first time the wording changes.
 */
const errorResponse = (res, { statusCode = 500, message = 'Internal server error', code = 'INTERNAL_ERROR', details }) => {
    return res.status(statusCode).json({
        ok: false,
        message,
        code,
        ...(details !== undefined ? { details } : {}),
    });
};

module.exports = { ok, created, errorResponse };
