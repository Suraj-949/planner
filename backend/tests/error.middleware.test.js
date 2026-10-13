const test = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler } = require('../src/middleware/error.middleware');
const { errorBody } = require('../src/utils/response');

for (const [error, status, code] of [
    [{ code: 11000, message: 'private database detail' }, 400, 'DUPLICATE_RECORD'],
    [{ name: 'ValidationError', message: 'private database detail' }, 400, 'VALIDATION_ERROR'],
    [{ name: 'CastError', message: 'private database detail' }, 400, 'INVALID_VALUE'],
    [{ type: 'entity.parse.failed', message: 'private database detail' }, 400, 'INVALID_JSON'],
    [{ type: 'entity.too.large', message: 'private database detail' }, 413, 'PAYLOAD_TOO_LARGE'],
    [{ statusCode: 404, message: 'Task not found' }, 404, 'NOT_FOUND'],
]) {
    test(`error envelope: ${code}`, () => {
        const res = {
            status(value) { this.statusCode = value; return this; },
            json(body) { this.body = body; return this; },
        };
        errorHandler(error, {}, res, () => assert.fail('unexpected next'));
        assert.equal(res.statusCode, status);
        assert.equal(res.body.ok, false);
        assert.equal(res.body.code, code);
        assert.ok(!res.body.message.includes('private'));
    });
}

test('auth, CSRF, and rate-limit errors share the same envelope', () => {
    for (const status of [400, 401, 403, 429, 500]) {
        const body = errorBody(status, 'Public message');
        assert.deepEqual(Object.keys(body), ['ok', 'code', 'message']);
        assert.equal(body.ok, false);
        assert.equal(typeof body.code, 'string');
    }
});

test('HTTP failures use the envelope through the real Express middleware stack', async () => {
    const app = require('../src/app');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        for (const [path, options, status, code] of [
            ['/missing', {}, 404, 'NOT_FOUND'],
            ['/api/tasks/fetch', {}, 401, 'UNAUTHORIZED'],
            ['/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, 400, 'BAD_REQUEST'],
            ['/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' }, 400, 'INVALID_JSON'],
            ['/api/health', { headers: { Origin: 'https://untrusted.example' } }, 403, 'FORBIDDEN'],
        ]) {
            const response = await fetch(base + path, options);
            assert.equal(response.status, status);
            const body = await response.json();
            assert.equal(body.ok, false);
            assert.equal(body.code, code);
            assert.equal(typeof body.message, 'string');
        }
    } finally {
        await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
});
