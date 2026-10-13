const { logger } = require('../utils/logger');
const { fail } = require('../utils/response');

// Every failure has one public envelope; database and parser internals stay private.
function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    if (err.code === 11000) return fail(res, 400, 'A record with these values already exists', 'DUPLICATE_RECORD');
    if (err.name === 'ValidationError') return fail(res, 400, 'Invalid record values', 'VALIDATION_ERROR');
    if (err.name === 'CastError') return fail(res, 400, 'Invalid field value', 'INVALID_VALUE');
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'Invalid JSON body', 'INVALID_JSON');
    if (err.type === 'entity.too.large') return fail(res, 413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');

    const status = err.statusCode || 500;
    if (status >= 500) {
        logger.error('Unhandled error', {
            requestId: req.requestId, method: req.method, path: req.originalUrl,
            statusCode: status, error: err.stack || err.message,
        });
    }
    return fail(res, status, status >= 500 ? 'Internal server error' : err.message,
        undefined, status < 500 ? err.details : undefined);
}

module.exports = { errorHandler };
