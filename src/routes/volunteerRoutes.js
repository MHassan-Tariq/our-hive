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
 *     description: Submit structured hours with date, times, category and notes.
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
 *     responses:
 *       200:
 *         description: Hours logged successfully.
 *       400:
 *         description: Invalid hours provided.
 */
router.post('/log-hours', logHours);

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
 *     description: Retrieve detailed profile including impact stats and verification status.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully.
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
 *               agreedToHandbook: { type: boolean }
 *               profilePictureUrl: { type: string }
 *               location: { type: string, example: "New York, NY" }
 *               backgroundCheckStatus: { type: string, enum: ['Not Started', 'Pending', 'Verified', 'Action Required'] }
 *     responses:
 *       200:
 *         description: Profile saved successfully.
 */
router.route('/profile')
  .get(getProfile)
  .post(
    upload.fields([
      { name: 'governmentId', maxCount: 1 },
      { name: 'drivingLicense', maxCount: 1 },
    ]),
    saveProfile
  );

/**
 * @swagger
 * /api/volunteer/my-tasks:
 *   get:
 *     summary: Get all opportunities the volunteer has joined
 *     description: >
 *       Returns a list of every opportunity this volunteer has claimed a spot for,
 *       with partner details populated. Status of each opportunity is included
 *       so the frontend can badge completed vs. active tasks.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of joined opportunities.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Opportunity'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a volunteer.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-tasks', getMyTasks);

module.exports = router;
