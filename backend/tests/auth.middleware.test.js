const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test_secret_that_is_definitely_long_enough_32';

const { authMiddleware } = require('../src/middleware/auth.middleware');
const { signAccessToken, signRefreshToken } = require('../src/utils/tokens');

const USER_ID = '507f1f77bcf86cd799439011';

const run = (req) => {
    const res = { status: () => res, json: (payload) => payload };
    let error = null;

    authMiddleware(req, res, (err) => {
        error = err;
    });

    return error;
};

const makeReq = (headers) => ({ headers });

test('rejects a request with no Authorization header', () => {
    const err = run(makeReq({}));

    assert.equal(err.statusCode, 401);
});

test('rejects a non-Bearer scheme', () => {
    assert.equal(run(makeReq({ authorization: 'Basic abc123' })).statusCode, 401);
});

test('rejects an empty bearer value', () => {
    assert.equal(run(makeReq({ authorization: 'Bearer ' })).statusCode, 401);
});

test('accepts a valid access token and exposes req.user', () => {
    const req = makeReq({ authorization: `Bearer ${signAccessToken(USER_ID)}` });
    let nextCalled = false;

    authMiddleware(req, {}, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user, USER_ID);
});

test('rejects a refresh token presented as a bearer access token', () => {
    const req = makeReq({ authorization: `Bearer ${signRefreshToken(USER_ID)}` });

    assert.equal(run(req).statusCode, 401);
});

test('rejects a malformed token', () => {
    assert.equal(run(makeReq({ authorization: 'Bearer not.a.jwt' })).statusCode, 401);
});

/*
 * An expired token is the case that actually happens in production, and it was the one
 * missing from this boundary. A signature and type check alone are not enough: without this
 * a dead session stays authenticated indefinitely.
 */
test('rejects an expired access token', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: USER_ID, type: 'access' }, process.env.JWT_SECRET, {
        expiresIn: -1,
    });
    const req = makeReq({ authorization: `Bearer ${expired}` });

    // Express signals failure by calling next(err), so the assertion is on the error
    // being handed over — not on next() being withheld.
    const err = run(req);

    assert.ok(err, 'an expired token must produce an error');
    assert.equal(err.statusCode, 401);
    assert.equal(req.user, undefined, 'an expired token must not populate req.user');
});

test('never leaks the token or secret back to the caller', () => {
    const token = signAccessToken(USER_ID);
    const err = run(makeReq({ authorization: `Bearer ${token}x` }));
    const serialised = JSON.stringify({
        message: err && err.message,
        statusCode: err && err.statusCode,
    });

    assert.equal(serialised.includes(token), false);
    assert.equal(serialised.includes(process.env.JWT_SECRET), false);
    assert.equal(err.statusCode, 401);
});

/*
 * RFC 7235 §2.1: the auth-scheme token is case-insensitive, so `bearer`, `Bearer` and
 * `BEARER` are equivalent. The middleware matched `Bearer ` exactly, which silently
 * rejected conformant clients and proxies that normalise the case.
 */
test('accepts the scheme case-insensitively, per RFC 7235', () => {
    for (const scheme of ['Bearer', 'bearer', 'BEARER', 'BeArEr']) {
        const req = makeReq({ authorization: `${scheme} ${signAccessToken(USER_ID)}` });
        let nextCalled = false;

        authMiddleware(req, {}, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true, `${scheme} should be accepted`);
        assert.equal(req.user, USER_ID);
    }
});

test('a token with extra whitespace still authenticates', () => {
    const req = makeReq({ authorization: `Bearer    ${signAccessToken(USER_ID)}` });
    let nextCalled = false;

    authMiddleware(req, {}, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
});

test('still rejects a non-bearer scheme regardless of case', () => {
    for (const header of ['Basic abc123', 'Token abc123', 'Bearerish abc123', 'abc123']) {
        assert.equal(run(makeReq({ authorization: header })).statusCode, 401, header);
    }
});
