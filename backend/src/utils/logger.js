const crypto = require('crypto');

/*
 * Structured logger.
 *
 * `console.log` writes unstructured text that cannot be filtered, searched, or alerted on.
 * Every entry here is one JSON object on a single line, so a log aggregator can index the
 * fields directly.
 *
 * Deliberately dependency-free: pino or winston would be the production choice, but the
 * value is in the *shape* of the output, and pulling in a dependency for that alone is not
 * worth it at this stage.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

// Fields that must never reach the log sink.
const REDACTED = '[redacted]';
const SENSITIVE_KEYS = [
    'password',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'token',
    'secret',
    'jwt',
];

function redact(key, value) {
    const normalised = key.toLowerCase();

    if (SENSITIVE_KEYS.some((sensitive) => normalised.includes(sensitive))) {
        return REDACTED;
    }

    return value;
}

function write(level, message, context) {
    if (LEVELS[level] < MIN_LEVEL) return;

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context,
    };

    // JSON.stringify replacer applies redaction to every key at every depth.
    const line = JSON.stringify(entry, (key, value) => redact(key, value));

    if (level === 'error') {
        process.stderr.write(`${line}\n`);
    } else {
        process.stdout.write(`${line}\n`);
    }
}

const logger = {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),

    // Child loggers carry fixed fields (requestId, userId) so each line is self-describing.
    child: (bindings) => ({
        debug: (message, context) => write('debug', message, { ...bindings, ...context }),
        info: (message, context) => write('info', message, { ...bindings, ...context }),
        warn: (message, context) => write('warn', message, { ...bindings, ...context }),
        error: (message, context) => write('error', message, { ...bindings, ...context }),
    }),
};

module.exports = { logger, redact };
