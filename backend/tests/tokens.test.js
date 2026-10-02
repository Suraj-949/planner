const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test_secret_that_is_definitely_long_enough_32';

// Imported after the env is set: tokens.js reads JWT_SECRET lazily, but this keeps the
// ordering explicit.
const {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
} = require('../src/utils/tokens');

const USER_ID = '507f1f77bcf86cd799439011';

test('an access token verifies as an access token', () => {
    const decoded = verifyAccessToken(signAccessToken(USER_ID));

    assert.equal(decoded.id, USER_ID);
    assert.equal(decoded.type, 'access');
});

test('a refresh token cannot be replayed as an access token', () => {
    // Both are signed with the same secret, so without the `type` claim check in
    // verifyToken() this would pass and grant access.
    const refresh = signRefreshToken(USER_ID);

    assert.throws(() => verifyAccessToken(refresh));
    assert.equal(verifyRefreshToken(refresh).type, 'refresh');
});

test('an access token cannot be used to refresh', () => {
    assert.throws(() => verifyRefreshToken(signAccessToken(USER_ID)));
});

test('a token signed with another secret is rejected', () => {
    const jwt = require('jsonwebtoken');
    const foreign = jwt.sign({ id: USER_ID, type: 'access' }, 'a-different-secret', {
        expiresIn: '15m',
    });

    assert.throws(() => verifyAccessToken(foreign));
});

/*
 * Expiry. The suite previously checked the signature and the type claim but never the clock,
 * so a change that pinned `expiresIn` to a large value — or removed it — would have passed.
 * `expiresIn: -1` mints an already-expired token, which keeps the test instant and honest
 * instead of sleeping.
 */
test('an expired access token is rejected', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: USER_ID, type: 'access' }, process.env.JWT_SECRET, {
        expiresIn: -1,
    });

    assert.throws(() => verifyAccessToken(expired), /jwt expired/i);
});

test('an expired refresh token is rejected', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: USER_ID, type: 'refresh' }, process.env.JWT_SECRET, {
        expiresIn: -1,
    });

    assert.throws(() => verifyRefreshToken(expired), /jwt expired/i);
});

test('signAccessToken carries a bounded, non-trivial expiry', () => {
    const decoded = verifyAccessToken(signAccessToken(USER_ID));
    const lifetimeSeconds = decoded.exp - decoded.iat;

    assert.ok(lifetimeSeconds > 0, 'access token must expire');
    assert.ok(lifetimeSeconds <= 60 * 60, `access token lives too long: ${lifetimeSeconds}s`);
});

test('refresh tokens outlive access tokens, so a live session survives re-login', () => {
    const access = verifyAccessToken(signAccessToken(USER_ID));
    const refresh = verifyRefreshToken(signRefreshToken(USER_ID));

    assert.ok(
        refresh.exp > access.exp,
        'a refresh token that dies with the access token makes refresh pointless'
    );
});

test('tokens carry an id and a type, and nothing that could be trusted from the client', () => {
    const decoded = verifyAccessToken(signAccessToken(USER_ID));

    assert.equal(decoded.id, USER_ID);
    assert.equal(decoded.type, 'access');
    assert.equal(decoded.role, undefined, 'role must not be embedded in the token');
    assert.equal(decoded.password, undefined);
});
