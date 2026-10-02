/*
 * CSRF guard for cookie-authenticated state-changing requests.
 *
 * The refresh token is stored in a cookie, so any cross-site form POST to a cookie-using
 * endpoint would be sent by the browser automatically. `sameSite: 'lax'` already blocks
 * most of these, but it is a browser policy, not an application control — older browsers
 * ignore it, and it says nothing about same-site subresource attacks.
 *
 * This is the standard "verify the Origin" check: a cross-site attacker can make the
 * browser *send* a request, but cannot forge the `Origin` it sends from a page they do
 * not control.
 *
 * Two deliberate design points:
 *
 *  - Only enforced when a refresh cookie is actually present, so unauthenticated
 *    endpoints are untouched and ordinary API clients that do not use cookies are
 *    unaffected.
 *
 *  - A request carrying *neither* `Origin` nor `Referer` is allowed through. Browsers
 *    always send `Origin` on any POST, so a genuine cross-site attack cannot produce that
 *    combination; blocking it instead would only break non-browser callers and proxies
 *    that strip the header. `sameSite: 'lax'` is the backstop in that case.
 */

const ALLOWED_ORIGINS = (
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originAllowed(value) {
    if (!value) return false;

    try {
        // Referer carries a path ("/page"), so only its origin part is compared.
        return ALLOWED_ORIGINS.includes(new URL(value).origin);
    } catch {
        return false;
    }
}

function csrfGuard(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    if (!req.cookies?.refreshToken) return next();

    const { origin, referer } = req.headers;

    if (origin && !originAllowed(origin)) {
        return res.status(403).json({ ok: false, message: 'Request origin is not allowed' });
    }

    // No Origin header — fall back to Referer, which a browser also cannot forge
    // cross-site.
    if (!origin && referer && !originAllowed(referer)) {
        return res.status(403).json({ ok: false, message: 'Request origin is not allowed' });
    }

    return next();
}

module.exports = { csrfGuard, originAllowed };
