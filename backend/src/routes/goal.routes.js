const express = require('express');
const goalController = require('../controllers/goal.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Every route is authenticated, and every handler scopes its query to req.user.
router.post('/create', authMiddleware, goalController.createGoal);
router.get('/fetch', authMiddleware, goalController.getGoals);
router.get('/fetch/:id', authMiddleware, goalController.getGoal);
router.put('/update/:id', authMiddleware, goalController.updateGoal);
router.delete('/delete/:id', authMiddleware, goalController.deleteGoal);

module.exports = router;
