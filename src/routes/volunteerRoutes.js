const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { saveProfile, getMyTasks } = require('../controllers/volunteerController');

// All volunteer routes require auth + volunteer role
router.use(protect);
router.use(authorize('volunteer'));

/**
 * @swagger
 * /api/volunteer/profile:
 *   post:
 *     summary: Save or update volunteer profile
 *     description: >
 *       Saves the volunteer's personal info and skills. Uses upsert — calling
 *       this multiple times updates rather than duplicates.
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
 *               fullName:
 *                 type: string
 *                 example: Ahmed Khan
 *               phone:
 *                 type: string
 *                 example: "+92-300-1234567"
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Driving", "First Aid", "Cooking"]
 *               availability:
 *                 type: object
 *                 properties:
 *                   weekdays:
 *                     type: boolean
 *                     example: true
 *                   weekends:
 *                     type: boolean
 *                     example: false
 *     responses:
 *       200:
 *         description: Profile saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VolunteerProfileResponse'
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
router.post('/profile', saveProfile);

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
