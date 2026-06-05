const express = require('express');
const taskController = require('../controllers/task.controller');
const authMiddleWare = require('../middleware/auth.middleware')

const router = express.Router();

router.post('/create', authMiddleWare.authMiddleware, taskController.createTask)


module.exports = router;
