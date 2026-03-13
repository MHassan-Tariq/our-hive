const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  getDonorProfile,
  updateDonorProfile,
  updateUserProfile,
  getMyJoinedEvents,
  getDonorJoinedOpportunities,
  getDonations,
  getMonetaryDonations,
  getInKindDonations,
  getDonationById,
  getDonationStats,
  joinEventAsGuest,
  leaveEvent,
} = require('../controllers/donorController');

router.use(protect);
router.use(authorize('donor'));

/**
 * @swagger
 * /api/donor/profile:
 *   get:
 *     summary: Get donor profile
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donor profile data
 */
router.get('/profile', getDonorProfile);

/**
 * @swagger
 * /api/donor/profile:
 *   put:
 *     summary: Update donor profile
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monthlyGoal:
 *                 type: number
 *                 example: 80
 */
router.put('/profile', updateDonorProfile);

/**
 * @swagger
 * /api/donor/profile/info:
 *   patch:
 *     summary: Update user profile information
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: "John" }
 *               lastName: { type: string, example: "Doe" }
 *               phone: { type: string, example: "(555) 123-4567" }
 *               address: { type: string, example: "123 Main St, City, State 12345" }
 *               profilePicture: { type: string, format: binary, description: "Profile picture file" }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile/update', upload.single('profilePicture'), updateUserProfile);

/**
 * @swagger
 * /api/donor/my-events:
 *   get:
 *     summary: Get events joined by donor
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of joined events
 */
router.get('/my-events', getMyJoinedEvents);

/**
 * @swagger
 * /api/donor/joined-opportunities:
 *   get:
 *     summary: Get all joined opportunities with filters
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by opportunity status (e.g., Active, Completed)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *         description: Sort by date (newest first by default)
 *     responses:
 *       200:
 *         description: List of all joined opportunities
 */
router.get('/joined-opportunities', getDonorJoinedOpportunities);

/**
 * @swagger
 * /api/donor/events/{id}/join:
 *   post:
 *     summary: Join an event as a donor guest
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Successfully joined event
 */
router.post('/events/join', joinEventAsGuest);

/**
 * @swagger
 * /api/donor/events/{id}/leave:
 *   delete:
 *     summary: Leave an event
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Successfully left event
 */
router.delete('/events/:id/leave', leaveEvent);

/**
 * @swagger
 * /api/donor/donations:
 *   get:
 *     summary: Get all donations made by donor (Monetary & In-Kind)
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [monetary, in-kind]
 *         description: Filter by donation type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (pending, completed, etc.)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *         description: Sort by date
 *     responses:
 *       200:
 *         description: List of all donations with counts
 */
router.get('/donations', getDonations);

/**
 * @swagger
 * /api/donor/donations/stats:
 *   get:
 *     summary: Get donation statistics for donor
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donation statistics
 */
router.get('/donations/stats', getDonationStats);

/**
 * @swagger
 * /api/donor/donations/monetary:
 *   get:
 *     summary: Get monetary donations made by donor
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *         description: Sort by date
 *     responses:
 *       200:
 *         description: List of monetary donations
 */
router.get('/donations/monetary', getMonetaryDonations);

/**
 * @swagger
 * /api/donor/donations/in-kind:
 *   get:
 *     summary: Get in-kind donations made by donor
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *         description: Sort by date
 *     responses:
 *       200:
 *         description: List of in-kind donations
 */
router.get('/donations/in-kind', getInKindDonations);

/**
 * @swagger
 * /api/donor/donations/{id}:
 *   get:
 *     summary: Get donation details by ID
 *     tags: [Donor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Donation ID
 *     responses:
 *       200:
 *         description: Donation details
 *       404:
 *         description: Donation not found
 */
router.get('/donations/:id', getDonationById);

module.exports = router;