const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { selectRole } = require('../controllers/userController');

router.use(protect);

/**
 * @swagger
 * /api/user/select-role:
 *   patch:
 *     summary: Upgrade visitor account to a specific role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [volunteer, donor, sponsor, participant]
 *     responses:
 *       200:
 *         description: Role upgraded successfully
 *       400:
 *         description: User not a visitor or invalid role
 */
router.patch('/select-role', authorize('visitor'), selectRole);

module.exports = router;
