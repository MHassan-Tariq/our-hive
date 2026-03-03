const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  selectRole,
  getNotifications,
  markNotificationAsRead,
  getSettings,
  updateSettings,
  updateProfile,
} = require('../controllers/userController');

router.use(protect);

/**
 * @swagger
 * /api/user/settings:
 *   get:
 *     summary: Get user settings and preferences
 *     description: Returns display name (e.g. Org Name for sponsors), header role, and preferences.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved.
 *   patch:
 *     summary: Update user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationEnabled: { type: boolean }
 *               language: { type: string, example: "English" }
 *     responses:
 *       200:
 *         description: Preferences updated.
 */
router.route('/settings')
  .get(getSettings)
  .patch(updateSettings);

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     summary: Get user notifications
 *     description: Retrieves the user's notifications statically segmented into "newUpdates" (unread & < 24h old) and "earlier" (read or > 24h old).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications successfully retrieved and segmented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newUpdates:
 *                       type: array
 *                       description: Unread notifications generated within the last 24 hours
 *                       items:
 *                         $ref: '#/components/schemas/NotificationResponse'
 *                     earlier:
 *                       type: array
 *                       description: Read notifications or notifications older than 24 hours
 *                       items:
 *                         $ref: '#/components/schemas/NotificationResponse'
 */
router.get('/notifications', getNotifications);

/**
 * @swagger
 * /api/user/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Sets the isRead flag to true for a specific notification. This removes the "unread dot" in the UI.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification successfully marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/NotificationResponse'
 *       404:
 *         description: Notification not found
 */
router.patch('/notifications/:id/read', markNotificationAsRead);

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

/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     summary: Update core user profile fields
 *     description: Update user profile including name, phone, and mailing address. You can provide either fullName (which will be split) or firstName/lastName separately.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Full name of the user (e.g. "Jane Doe"). Will be split into firstName and lastName.
 *                 example: "Jane Doe"
 *               firstName: 
 *                 type: string
 *                 example: "Jane"
 *               lastName: 
 *                 type: string
 *                 example: "Doe"
 *               phone: { type: string }
 *               mailingAddress: { type: string }
 *               profilePicture: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
router.patch('/profile', upload.single('profilePicture'), updateProfile);

module.exports = router;
