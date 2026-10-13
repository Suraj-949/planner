const express = require('express');
const milestoneController = require('../controllers/milestone.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

/*
 * Milestones are always listed under a goal, so `goalId` is a query parameter rather than
 * a path segment — a milestone has no userId of its own and is only reachable through the
 * goal that owns it.
 */
router.post('/create', authMiddleware, milestoneController.createMilestone);
router.get('/fetch', authMiddleware, milestoneController.getMilestones);
router.put('/update/:id', authMiddleware, milestoneController.updateMilestone);
router.patch('/complete/:id', authMiddleware, milestoneController.setMilestoneCompleted);
router.delete('/delete/:id', authMiddleware, milestoneController.deleteMilestone);

module.exports = router;
