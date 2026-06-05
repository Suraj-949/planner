const express = require('express');
const authContoller = require('../controllers/auth.controller');

const router = express.Router();



router.post('/register', authContoller.register)

router.post('/login', authContoller.login)

router.post('/refresh-token', authContoller.refreshToken)

module.exports = router;
