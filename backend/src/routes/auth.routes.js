const express = require('express');
const authController = require('../controllers/auth.controller');
const { asyncHandler } = require('../utils/http');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// authLimiter is attached to the credential endpoints only. Refresh is excluded: the
// client calls it on every 401, and a locked-out refresh would break the app for a
// signed-in user rather than an attacker.
router.post('/register', authLimiter, asyncHandler(authController.register));

router.post('/login', authLimiter, asyncHandler(authController.login));

router.post('/refresh-token', asyncHandler(authController.refreshToken));

router.post('/logout', asyncHandler(authController.logout));

module.exports = router;
