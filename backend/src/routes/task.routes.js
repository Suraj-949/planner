const express = require('express');
const taskController = require('../controllers/task.controller');
const authMiddleWare = require('../middleware/auth.middleware')

const router = express.Router();

router.post('/create', authMiddleWare.authMiddleware, taskController.createTask);

router.get('/fetch', authMiddleWare.authMiddleware, taskController.getTasks);

router.put('/update/:id', authMiddleWare.authMiddleware, taskController.updateTask);

module.exports = router;
