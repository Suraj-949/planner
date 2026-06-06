const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

function createAccessToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function createRefreshToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

function setRefreshCookie(res, refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Local development uses http://localhost, so the cookie must stay non-secure there.
    
    // save the refresh token in an httpOnly cookie with appropriate security settings based on the environment
    res.cookie('refreshToken', refreshToken, {    
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',  // In production, we need 'none' to allow cross-site cookies. In development, 'lax' is sufficient and more secure.
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}





async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        const isUsernameExists = await userModel.findOne({ username });
        const isEmailExists = await userModel.findOne({ email });

        if (isUsernameExists) {
            return res.status(400).json({
                message: 'Username already exists'
            });
        }

        if (isEmailExists) {
            return res.status(400).json({
                message: 'Email already exists'
            });
        }
        
        // Hash the password before saving the user to the database
        const hashedPassword = await hashPassword(password);
        const user = new userModel({ username, email, password: hashedPassword });
        await user.save();

        const accessToken = createAccessToken(user._id);
        const refreshToken = createRefreshToken(user._id);

        // The refresh token lives in an httpOnly cookie so the browser can refresh access safely.
        setRefreshCookie(res, refreshToken);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                username: user.username,
                email: user.email
            },
            accessToken : accessToken
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({
            message: 'Registration failed',
            error: err.message
        });
    }
}






async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: 'Username or email and password are required'
            });
        }

        // Allow users to sign in with either their username or their email.
        const user = await userModel.findOne({
            $or: [{ username }, { email: username }]
        });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = createAccessToken(user._id);
        const refreshToken = createRefreshToken(user._id);

        // set refresh token in cookie
        setRefreshCookie(res, refreshToken);

        res.status(200).json({
            message: 'Login successful',
            user: {
                username: user.username,
                email: user.email
            },
            accessToken : accessToken
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({
            message: 'Login failed',
            error: err.message
        });
    }
}






async function refreshToken(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({
            message: 'Refresh token not found'
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const accessToken = createAccessToken(user._id);

        res.status(200).json({
            message: 'Access token refreshed successfully',
            accessToken : accessToken
        });
    } catch (err) {
        console.error('Refresh token error:', err.message);
        res.status(401).json({
            message: 'Failed to refresh token',
            error: err.message
        });
    }
}

module.exports = { register, login, refreshToken };
