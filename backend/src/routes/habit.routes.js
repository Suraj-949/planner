const express = require('express');
const habitController = require('../controllers/habit.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/create', authMiddleware, habitController.createHabit);
router.get('/fetch', authMiddleware, habitController.getHabits);
router.get('/fetch/:id', authMiddleware, habitController.getHabit);
router.get('/history/:id', authMiddleware, habitController.getHabitHistory);
router.put('/update/:id', authMiddleware, habitController.updateHabit);
router.patch('/archive/:id', authMiddleware, habitController.archiveHabit);
router.patch('/restore/:id', authMiddleware, habitController.unarchiveHabit);
router.post('/tick/:id', authMiddleware, habitController.tickHabit);
router.delete('/delete/:id', authMiddleware, habitController.deleteHabit);

module.exports = router;
