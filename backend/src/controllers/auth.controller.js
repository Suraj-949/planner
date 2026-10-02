const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
} = require('../utils/tokens');
const { logger } = require('../utils/logger');
const { ok, created } = require('../utils/response');

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Login failures return one identical message for "no such user" and "wrong password" so
// the endpoint cannot be used to enumerate which accounts exist.
const INVALID_CREDENTIALS = 'Invalid credentials';

function validateRegistrationFields({ username, email, password }) {
    if (!username || !email || !password) {
        return 'Username, email and password are required';
    }

    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
        return 'Username, email and password must be strings';
    }

    if (!username.trim()) {
        return 'Username cannot be empty';
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
        return 'Invalid email format';
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    return null;
}

function issueSession(res, user, statusCode, message) {
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    setRefreshCookie(res, refreshToken);

    const body = {
        message,
        user: {
            username: user.username,
            email: user.email,
        },
        accessToken,
    };

    if (statusCode === 201) {
        return created(res, body);
    }

    return ok(res, statusCode, body);
}

async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        const validationError = validateRegistrationFields({ username, email, password });
        if (validationError) {
            return res.status(400).json({ ok: false, message: validationError });
        }

        const normalisedUsername = username.trim();
        const normalisedEmail = email.trim().toLowerCase();

        const existingUser = await userModel.findOne({
            $or: [{ username: normalisedUsername }, { email: normalisedEmail }],
        });

        if (existingUser) {
            const field = existingUser.email === normalisedEmail ? 'email' : 'username';

            return res.status(400).json({ ok: false, message: `An account with this ${field} already exists` });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const user = new userModel({
            username: normalisedUsername,
            email: normalisedEmail,
            password: hashedPassword,
        });

        await user.save();

        return issueSession(res, user, 201, 'User registered successfully');
    } catch (err) {
        // A concurrent request can still win the race and trip the unique index.
        if (err.code === 11000) {
            return res.status(400).json({ ok: false, message: 'Username or email already exists' });
        }

        logger.error('Register error', { error: err.message });
        return res.status(500).json({ ok: false, message: 'Registration failed' });
    }
}

async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ ok: false, message: 'Username or email and password are required' });
        }

        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ ok: false, message: 'Username or email and password are required' });
        }

        const identifier = username.trim();

        // The password field is select:false on the schema, so the hash has to be
        // requested explicitly for the bcrypt comparison to be possible.
        const user = await userModel
            .findOne({
                $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
            })
            .select('+password');

        if (!user) {
            return res.status(401).json({ ok: false, message: INVALID_CREDENTIALS });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ ok: false, message: INVALID_CREDENTIALS });
        }

        return issueSession(res, user, 200, 'Login successful');
    } catch (err) {
        logger.error('Login error', { error: err.message });
        return res.status(500).json({ ok: false, message: 'Login failed' });
    }
}

async function refreshToken(req, res) {
    const existingToken = req.cookies?.refreshToken;

    if (!existingToken) {
        return res.status(401).json({ ok: false, message: 'Refresh token not found' });
    }

    try {
        const decoded = verifyRefreshToken(existingToken);
        const user = await userModel.findById(decoded.id);

        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ ok: false, message: 'Refresh token is no longer valid' });
        }

        return ok(res, 200, {
            message: 'Access token refreshed successfully',
            accessToken: signAccessToken(user._id),
        });
    } catch (err) {
        clearRefreshCookie(res);
        logger.error('Refresh token error', { error: err.message });

        return res.status(401).json({ ok: false, message: 'Failed to refresh token' });
    }
}

// Clearing the cookie is the server-side half of logout. It cannot invalidate access
// tokens that were already issued, so the client must also drop its stored copy.
function logout(req, res) {
    clearRefreshCookie(res);

    ok(res, 200, { message: 'Logged out successfully' });
}

module.exports = { register, login, refreshToken, logout };
