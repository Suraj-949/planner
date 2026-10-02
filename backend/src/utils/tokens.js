const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const TOKEN_TYPES = {
    ACCESS: 'access',
    REFRESH: 'refresh',
};

function getSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET is not set');
    }

    return secret;
}

function signToken(userId, type, expiresIn) {
    return jwt.sign({ id: userId, type }, getSecret(), { expiresIn });
}

function signAccessToken(userId) {
    return signToken(userId, TOKEN_TYPES.ACCESS, ACCESS_TOKEN_TTL);
}

function signRefreshToken(userId) {
    return signToken(userId, TOKEN_TYPES.REFRESH, REFRESH_TOKEN_TTL);
}

// Verifies a token and rejects it unless it carries the expected type claim, so a
// stolen refresh token cannot be replayed as a Bearer access token.
function verifyToken(token, expectedType) {
    const decoded = jwt.verify(token, getSecret());

    if (decoded.type !== expectedType) {
        throw new jwt.JsonWebTokenError('Unexpected token type');
    }

    return decoded;
}

function verifyAccessToken(token) {
    return verifyToken(token, TOKEN_TYPES.ACCESS);
}

function verifyRefreshToken(token) {
    return verifyToken(token, TOKEN_TYPES.REFRESH);
}

function setRefreshCookie(res, refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: REFRESH_COOKIE_MAX_AGE,
    });
}

function clearRefreshCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    });
}

module.exports = {
    TOKEN_TYPES,
    REFRESH_COOKIE_MAX_AGE,
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
};
