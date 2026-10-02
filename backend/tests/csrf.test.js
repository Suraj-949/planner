process.env.CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

const test = require('node:test');
const assert = require('node:assert/strict');

const { csrfGuard, originAllowed } = require('../src/middleware/csrf.middleware');

const run = (req) => {
    let passed = false;
    let status = null;

    const res = {
        status(code) {
            status = code;
            return res;
        },
        json() {
            return res;
        },
    };

    csrfGuard(req, res, () => {
        passed = true;
    });

    return { passed, status };
};

const makeReq = ({ method = 'POST', headers = {}, cookie } = {}) => ({
    method,
    headers,
    cookies: cookie === undefined ? {} : { refreshToken: cookie },
});

const COOKIE = 'a-refresh-token';

test('originAllowed compares only the origin part of a Referer URL', () => {
    assert.equal(originAllowed('http://localhost:5173/tasks?a=1'), true);
    assert.equal(originAllowed('https://attacker.example/steal.html'), false);
    assert.equal(originAllowed('http://localhost:5173.evil.com'), false);
    assert.equal(originAllowed(undefined), false);
});

test('safe methods pass through even with a cookie', () => {
    assert.equal(run(makeReq({ method: 'GET', cookie: COOKIE })).passed, true);
});

test('requests with no refresh cookie pass through', () => {
    // The guard is scoped to cookie-authenticated requests only.
    assert.equal(
        run(makeReq({ headers: { origin: 'https://attacker.example' } })).passed,
        true
    );
});

test('a cookie-bearing POST from an allowed origin passes', () => {
    assert.equal(
        run(
            makeReq({ headers: { origin: 'http://localhost:5173' }, cookie: COOKIE })
        ).passed,
        true
    );
});

test('a cookie-bearing POST from a foreign Origin is blocked', () => {
    const result = run(
        makeReq({ headers: { origin: 'https://attacker.example' }, cookie: COOKIE })
    );

    assert.equal(result.passed, false);
    assert.equal(result.status, 403);
});

test('a cookie-bearing POST with only a foreign Referer is blocked', () => {
    // This is the case PowerShell could not exercise, because it refuses to send Referer.
    const result = run(
        makeReq({
            headers: { referer: 'https://attacker.example/steal.html' },
            cookie: COOKIE,
        })
    );

    assert.equal(result.passed, false);
    assert.equal(result.status, 403);
});

test('a cookie-bearing POST with a same-site Referer passes', () => {
    assert.equal(
        run(
            makeReq({
                headers: { referer: 'http://localhost:5173/tasks' },
                cookie: COOKIE,
            })
        ).passed,
        true
    );
});

test('a cookie-bearing POST with neither header passes (non-browser client)', () => {
    // Locking this out would break curl/mobile/proxies that do not send Origin, while
    // adding no protection: a browser always sends Origin on a cross-site POST.
    assert.equal(run(makeReq({ cookie: COOKIE })).passed, true);
});