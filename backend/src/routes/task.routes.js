const express = require('express');
const taskController = require('../controllers/task.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Every task route is authenticated; the middleware also scopes each query to req.user.
router.post('/create', authMiddleware, taskController.createTask);
router.get('/fetch', authMiddleware, taskController.getTasks);
router.put('/update/:id', authMiddleware, taskController.updateTask);
router.delete('/delete/:id', authMiddleware, taskController.deleteTask);

module.exports = router;
