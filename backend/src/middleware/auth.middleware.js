const mongoose = require('mongoose');
const { verifyAccessToken } = require('../utils/tokens');
const { ApiError } = require('../utils/http');

/*
 * Extracts the bearer token and verifies it with the shared helper, which also enforces
 * the `type` claim. Calling jwt.verify() directly here would accept a refresh token as
 * an access token, because both are signed with the same secret.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new ApiError(401, 'Authorization header missing or malformed'));
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
        return next(new ApiError(401, 'Authorization header missing or malformed'));
    }

    let decoded;

    try {
        decoded = verifyAccessToken(token);
    } catch (err) {
        // The token itself is never logged — it is a credential.
        return next(new ApiError(401, 'Invalid or expired token'));
    }

    // Scoped to this user's documents by every query, so a tampered id in the payload
    // would only ever match another real user's rows, never a stranger's.
    req.user = decoded.id;
    req.tokenType = decoded.type;

    return next();
}

module.exports = { authMiddleware };
