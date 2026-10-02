const crypto = require('crypto');

/*
 * Request ID middleware.
 *
 * Every log line and every error response carries the same id, so a single user-visible
 * failure can be traced through the server logs without shipping a stack trace to the
 * client. The id is generated here rather than trusted from a header, so a caller cannot
 * collide with or spoof another request's id.
 */
function requestIdMiddleware(req, res, next) {
    const incoming = req.headers['x-request-id'];
    const requestId =
        typeof incoming === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(incoming)
            ? incoming
            : crypto.randomUUID();

    req.requestId = requestId;

    // Returned to the client so a support request can quote it.
    res.setHeader('x-request-id', requestId);

    next();
}

module.exports = { requestIdMiddleware };
