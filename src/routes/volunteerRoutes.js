const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  saveProfile,
  getProfile,
  updatePreferences,
  getMyTasks,
  logHours,
  getDashboardStats,
  getBadgeDetails,
  getLogHistory,
  getClaimedOpportunities,
  reassignBadges,
} = require('../controllers/volunteerController');

// All volunteer routes require auth + volunteer role
router.use(protect);
router.use(authorize('volunteer'));

// ... (lines 1-56 kept)
/**
 * @swagger
 * /api/volunteer/badges/{id}:
 *   get:
 *     summary: Get details for a specific badge
 *     description: Returns the badge name, level, ID number, and date earned.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The badge ID (e.g., '#BDG-7729') or Mongo ID
 *     responses:
 *       200:
 *         description: Badge details retrieved successfully.
 *       404:
 *         description: Badge not found.
 */
router.get('/badges/:id', getBadgeDetails);

/**
 * @swagger
 * /api/volunteer/dashboard:
 *   get:
 *     summary: Get volunteer dashboard statistics
 *     description: Returns total hours, hours this year, badge progress, and upcoming shifts.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     fullName: { type: 'string' }
 *                     hoursThisYear: { type: 'number' }
 *                     totalHours: { type: 'number' }
 *                     nextBadgeGoal: { type: 'number' }
 *                     upcomingShifts: { type: 'array', items: { $ref: '#/components/schemas/Opportunity' } }
 */
router.get('/dashboard', getDashboardStats);

/**
 * @swagger
 * /api/volunteer/log-hours:
 *   post:
 *     summary: Log volunteer hours
 *     description: Submit structured hours with date, times, category and notes. Optionally include an `opportunityId` in the body or call the `/log-hours/{id}` variant to tie the entry to a specific opportunity.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, format: date }
 *               startTime: { type: string, example: "09:00 AM" }
 *               endTime: { type: string, example: "01:00 PM" }
 *               category: { type: string }
 *               notes: { type: string }
 *               hours: { type: number, description: "Optional manual override" }
 *               opportunityId: { type: string, description: "(optional) ID of an opportunity for which these hours apply" }
 *     responses:
 *       200:
 *         description: Hours logged successfully.
 *       400:
 *         description: Invalid hours provided.
 */
router.post('/log-hours', logHours);
// allow linking to a specific opportunity by id in the URL (optional) for convenience
router.post('/log-hours/:id', logHours);

/**
 * @swagger
 * /api/volunteer/logs:
 *   get:
 *     summary: Get log history
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of logged hours.
 */
router.get('/logs', getLogHistory);

/**
 * @swagger
 * /api/volunteer/profile:
 *   get:
 *     summary: Get volunteer profile
 *     description: Retrieve detailed profile including impact stats, verification status, profile image URL, and any uploaded ID documents (governmentIdUrl & drivingLicenseUrl).
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully. Response body includes `profilePictureUrl`; may be empty string if no image set.
 *   post:
 *     summary: Save or update volunteer profile
 *     description: Detailed profile update including availability, document uploads, and avatar.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               skills:
 *                 type: string
 *                 description: Comma-separated list or JSON string of skills.
 *               availability:
 *                 type: string
 *                 description: JSON string of availability object.
 *               governmentId:
 *                 type: string
 *                 format: binary
 *               drivingLicense:
 *                 type: string
 *                 format: binary
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Avatar or profile image file (uploaded to Cloudinary, returns secure URL).
 *               agreedToHandbook: { type: boolean }
 *               profilePictureUrl: { type: string }
 *               location: { type: string, example: "New York, NY" }
 *               backgroundCheckStatus: { type: string, enum: ['Not Started', 'Pending', 'Verified', 'Action Required'] }
 *               mailingAddress: { type: string, example: "123 Main St, City, State, ZIP" }
 *               email: { type: string, format: email, example: "jane@ourhive.com" }
 *     responses:
 *       200:
 *         description: Profile saved successfully. Returned object includes `profilePictureUrl`.
 */
router.route('/profile')
  .get(getProfile)
  .post(
    upload.fields([
      { name: 'governmentId', maxCount: 1 },
      { name: 'drivingLicense', maxCount: 1 },
      { name: 'profilePicture', maxCount: 1 },
    ]),
    saveProfile
  );

/**
 * @swagger
 * /api/volunteer/upload-docs/{userId}:
 *   post:
 *     summary: Upload volunteer documents using userId
 *     description: Upload Government ID and Driving License for a specific user ID.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               governmentId:
 *                 type: string
 *                 format: binary
 *               drivingLicense:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully.
 */
router.post(
  '/upload-docs/:userId',
  upload.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'drivingLicense', maxCount: 1 },
  ]),
  require('../controllers/volunteerController').uploadVolunteerDocs
);

/**
 * @swagger
 * /api/volunteer/reassign-badges:
 *   post:
 *     summary: Manually reassign badges based on current total hours
 *     description: Clears and reassigns all badges based on the volunteer's current total hours. Useful for retroactive badge assignment.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badges reassigned successfully for current user.
 *       404:
 *         description: Volunteer profile not found.
 */
router.post('/reassign-badges', reassignBadges);

/**
 * @swagger
 * /api/volunteer/reassign-badges/{userId}:
 *   post:
 *     summary: Manually reassign badges for a specific user (admin only)
 *     description: Admin endpoint to reassign badges for another user.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to reassign badges for.
 *     responses:
 *       200:
 *         description: Badges reassigned successfully.
 *       404:
 *         description: Volunteer profile not found.
 */
router.post('/reassign-badges/:userId', reassignBadges);

router.get('/my-tasks', getMyTasks);
router.get('/claimed-opportunities', getClaimedOpportunities);
module.exports = router;
