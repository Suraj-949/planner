const rateLimit = require('express-rate-limit');

const jsonMessage = (message) => ({ message });

/*
 * Rate limits are split by cost: credential endpoints are the ones worth brute forcing,
 * so they get a tight budget, while ordinary task reads get a generous one.
 *
 * `keyGenerator` must derive from the IP only. Using the email in the key would let an
 * attacker lock a victim's account out with a handful of requests, and — because the
 * limiter counts before the handler runs — the app cannot know the request was invalid.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: jsonMessage('Too many attempts. Please try again later.'),
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: jsonMessage('Too many requests. Please slow down.'),
});

module.exports = { authLimiter, apiLimiter };
