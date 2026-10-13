const express = require('express');
const projectController = require('../controllers/project.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/create', authMiddleware, projectController.createProject);
router.get('/fetch', authMiddleware, projectController.getProjects);
router.put('/update/:id', authMiddleware, projectController.updateProject);
router.patch('/archive/:id', authMiddleware, projectController.archiveProject);
router.patch('/restore/:id', authMiddleware, projectController.unarchiveProject);
router.delete('/delete/:id', authMiddleware, projectController.deleteProject);

module.exports = router;
