// Shared error plumbing.
//
// Every controller is async, so a rejected promise never reaches Express' default error
// handler unless it is forwarded with next(). `asyncHandler` closes that gap once,
// instead of wrapping every controller individually.

/*
 * Stable, machine-readable codes. A client branching on the human message breaks the
 * moment anyone rewords it or adds a translation, so the code is the contract and the
 * message is presentation.
 */
const STATUS_CODES = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE',
    429: 'RATE_LIMITED',
};

class ApiError extends Error {
    constructor(statusCode, message, details, code) {
        super(message);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;
        // Explicit code wins; otherwise derive one so an error created with only a status
        // still reaches the client with a usable discriminator.
        this.code = code ?? STATUS_CODES[statusCode] ?? 'INTERNAL_ERROR';

        Error.captureStackTrace?.(this, ApiError);
    }
}

const badRequest = (message, details, code) => new ApiError(400, message, details, code);
const unauthorized = (message = 'Authentication required') => new ApiError(401, message);
const forbidden = (message = 'Not allowed') => new ApiError(403, message);
const notFound = (message = 'Resource not found') => new ApiError(404, message);
const conflict = (message, details, code) => new ApiError(409, message, details, code);

// Forwards rejections from async route handlers to Express' error pipeline.
const asyncHandler = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

/*
 * Splits a validated value bag into Mongo's `$set` and `$unset`.
 *
 * A field the client explicitly nulled arrives as `undefined`, meaning "clear this".
 * Mongoose strips undefined keys out of `$set`, so passing the bag straight through
 * silently ignored every clear — "remove the description" had never actually worked.
 * Those keys have to be moved to `$unset` for the request to mean what it says.
 *
 * Used by every update handler so the split cannot be forgotten on a new controller.
 */
const buildUpdate = (value) => {
    const set = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
    const unset = Object.fromEntries(
        Object.keys(value)
            .filter((key) => value[key] === undefined)
            .map((key) => [key, 1])
    );

    const update = {};

    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    return update;
};

module.exports = {
    ApiError,
    STATUS_CODES,
    asyncHandler,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    buildUpdate,
};
