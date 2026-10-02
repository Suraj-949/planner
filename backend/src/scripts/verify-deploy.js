/*
 * Post-deploy verification.
 *
 * The refresh token is an HTTP-only cookie, and browsers silently reject a
 * `Secure` cookie sent over plain HTTP. That means a deployment can pass every
 * local test and still fail logins in production for reasons no unit test would
 * catch. This script checks the wire-level behaviour that actually matters.
 *
 * Usage:
 *   node src/scripts/verify-deploy.js <baseUrl> <allowedOrigin> [disallowedOrigin]
 *
 * Example:
 *   node src/scripts/verify-deploy.js \
 *     https://planner-api.onrender.com \
 *     https://planner-frontend.onrender.com \
 *     https://evil.example.com
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 *
 * LIMITATION: this inspects headers, which is all that is observable from outside a
 * browser. Whether the browser actually *stores* the cookie, and whether the CSRF
 * guard passes in a real browser, still needs the manual browser check documented in
 * DEPLOYMENT.md.
 */

const BASE_URL = (process.argv[2] || '').replace(/\/$/, '');
const ALLOWED_ORIGIN = process.argv[3] || '';
const DISALLOWED_ORIGIN = process.argv[4] || 'https://disallowed.example.com';

const results = [];

function check(name, passed, detail) {
    results.push({ name, passed, detail });
    const mark = passed ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${name}`);
    if (detail) console.log(`         ${detail}`);
}

async function main() {
    if (!BASE_URL || !ALLOWED_ORIGIN) {
        console.error('Usage: node src/scripts/verify-deploy.js <baseUrl> <allowedOrigin> [disallowedOrigin]');
        process.exit(2);
    }

    const isHttps = BASE_URL.startsWith('https://');
    console.log(`\nVerifying ${BASE_URL}`);
    console.log(`Allowed origin: ${ALLOWED_ORIGIN}\n`);

    /* -- 1. health endpoint and response envelope ---------------------------- */
    try {
        const res = await fetch(`${BASE_URL}/api/health`);

        check(
            'health endpoint responds 200',
            res.status === 200,
            `status ${res.status}`
        );

        const body = await res.json().catch(() => null);
        check(
            'health uses the { ok, data } envelope',
            body && body.ok === true && body.data !== undefined,
            JSON.stringify(body)
        );
    } catch (err) {
        check('health endpoint responds 200', false, err.message);
        return;
    }

    /* -- 2. CORS allows the real frontend ------------------------------------ */
    {
        const res = await fetch(`${BASE_URL}/api/health`, {
            headers: { Origin: ALLOWED_ORIGIN },
        });

        const allowOrigin = res.headers.get('access-control-allow-origin');
        const allowCredentials = res.headers.get('access-control-allow-credentials');

        check(
            'CORS echoes the allowed origin',
            allowOrigin === ALLOWED_ORIGIN,
            `Access-Control-Allow-Origin: ${allowOrigin}`
        );

        // Without this the browser drops the response even though the origin matched,
        // and the refresh cookie never comes back.
        check(
            'CORS allows credentials',
            allowCredentials === 'true',
            `Access-Control-Allow-Credentials: ${allowCredentials}`
        );
    }

    /* -- 3. CORS refuses an unknown origin ------------------------------------ */
    {
        const res = await fetch(`${BASE_URL}/api/health`, {
            headers: { Origin: DISALLOWED_ORIGIN },
        });

        check(
            'CORS rejects an unknown origin',
            res.status === 403,
            `status ${res.status} (expected 403)`
        );
    }

    /* -- 4. refresh cookie attributes ----------------------------------------- */
    {
        const username = `verify_${Date.now()}`;
        const email = `${username}@example.com`;

        const res = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
            body: JSON.stringify({ username, email, password: 'Verify123!' }),
        });

        const setCookie = res.headers.get('set-cookie');

        if (!setCookie || !setCookie.includes('refreshToken=')) {
            check('refresh cookie is set on register', false, `Set-Cookie: ${setCookie}`);
        } else {
            check('refresh cookie is set on register', true, '');

            // HttpOnly keeps the token away from JavaScript, so XSS cannot read it.
            check('refresh cookie is HttpOnly', /httponly/i.test(setCookie), '');

            // These two only work together over real HTTPS. Over plain HTTP a browser
            // drops the cookie entirely and every refresh fails.
            check(
                'refresh cookie is Secure',
                /;\s*secure/i.test(setCookie),
                isHttps ? '' : 'NOTE: served over http, so Secure cannot be honoured'
            );

            check(
                'refresh cookie is SameSite=None (cross-origin frontend)',
                /samesite=none/i.test(setCookie),
                'lax is correct only when the API and frontend share a site'
            );

            // `Domain` would widen the cookie to sibling subdomains; its absence is
            // the safer default.
            check(
                'refresh cookie has no Domain attribute',
                !/;\s*domain=/i.test(setCookie),
                'a Domain would expose the cookie to other subdomains'
            );
        }
    }

    /* -- 5. CSRF guard blocks a cookie-bearing write from elsewhere ------------ */
    {
        // A foreign Origin must be refused by the CSRF guard before the request is
        // ever treated as authenticated, regardless of whether credentials exist.
        const csrf = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: DISALLOWED_ORIGIN },
            body: JSON.stringify({ username: 'nobody', password: 'wrongpassword' }),
        });

        check(
            'CSRF blocks a cookie-bearing write from a foreign origin',
            csrf.status === 403,
            `status ${csrf.status} (expected 403)`
        );
    }

    /* -- summary --------------------------------------------------------------- */
    const failed = results.filter((r) => !r.passed);

    console.log('');
    console.log(`  ${results.length - failed.length}/${results.length} checks passed`);

    if (failed.length > 0) {
        console.log('');
        console.log('  FAILED:');
        for (const f of failed) console.log(`    - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
        console.log('');
        process.exit(1);
    }

    if (!isHttps) {
        console.log('');
        console.log('  WARNING: this URL is not HTTPS. Secure cookies are dropped by browsers');
        console.log('  over plain HTTP, so sign-in will fail in a real browser even though');
        console.log('  every check above passed.');
    }

    console.log('');
}

main().catch((err) => {
    console.error(`\nVerification crashed: ${err.message}\n`);
    process.exit(1);
});