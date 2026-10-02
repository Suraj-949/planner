// Shared error plumbing.
//
// Every controller is async, so a rejected promise never reaches Express' default error
// handler unless it is forwarded with next(). `asyncHandler` closes that gap once,
// instead of wrapping every controller individually.

class ApiError extends Error {
    constructor(statusCode, message, details) {
        super(message);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;

        Error.captureStackTrace?.(this, ApiError);
    }
}

const badRequest = (message, details) => new ApiError(400, message, details);
const unauthorized = (message = 'Authentication required') => new ApiError(401, message);
const forbidden = (message = 'Not allowed') => new ApiError(403, message);
const notFound = (message = 'Resource not found') => new ApiError(404, message);

// Forwards rejections from async route handlers to Express' error pipeline.
const asyncHandler = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

module.exports = {
    ApiError,
    asyncHandler,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
};
