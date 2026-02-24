const express = require('express');
const router = express.Router();
const { getAllUsers, getDashboard, updatePartnerStatus, addVolunteerHours, getFinances, getParticipantSummary } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/participants/summary:
 *   get:
 *     summary: Get summary of all participants (masked names for privacy)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of participants with masked names
 */
router.get('/participants/summary', getParticipantSummary);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Returns a list of all registered users. Requires a valid Admin JWT Bearer token.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users retrieved successfully.
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
 *                   example: 12
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized — no token or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Not authorized — no token provided"
 *       403:
 *         description: Forbidden — user does not have the admin role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Access denied — role 'visitor' is not permitted to access this resource"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/users', getAllUsers);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard stats (Admin only)
 *     description: >
 *       Returns aggregate statistics including total user count, a breakdown of
 *       users per role, and a list of Partner accounts pending approval.
 *       Requires a valid Admin JWT Bearer token.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardResponse'
 *             example:
 *               success: true
 *               data:
 *                 totalUsers: 26
 *                 roleCounts:
 *                   visitor: 10
 *                   participant: 5
 *                   volunteer: 3
 *                   donor: 2
 *                   sponsor: 1
 *                   partner: 4
 *                   admin: 1
 *                 pendingPartners:
 *                   - _id: "64abc123def456"
 *                     name: "Acme Corp"
 *                     email: "acme@partner.com"
 *                     role: "partner"
 *                     isApproved: false
 *       401:
 *         description: Unauthorized — no token or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user does not have the admin role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/admin/partners/{id}/status:
 *   patch:
 *     summary: Approve or reject a partner profile (Admin only)
 *     description: >
 *       Sets the partner's `status` field to `approved` or `rejected`.
 *       Also updates `isApproved` on the linked User document to keep the
 *       dashboard counts consistent.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The PartnerProfile document `_id`
 *         example: 64abc123def456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: approved
 *     responses:
 *       200:
 *         description: Partner status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerProfileResponse'
 *       400:
 *         description: Invalid status value provided.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Status must be either 'approved' or 'rejected'"
 *       401:
 *         description: Unauthorized — no or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Partner profile not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/partners/:id/status', updatePartnerStatus);

/**
 * @swagger
 * /api/admin/volunteer/add-hours/{id}:
 *   patch:
 *     summary: Add volunteer hours after task completion (Admin only)
 *     description: >
 *       Atomically increments a volunteer's `totalHours` by the specified amount.
 *       Use the VolunteerProfile `_id` (not the User `_id`) as the path parameter.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The VolunteerProfile document `_id`
 *         example: 64vol789xyz321
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hours
 *             properties:
 *               hours:
 *                 type: number
 *                 minimum: 0.5
 *                 example: 4
 *                 description: Number of hours to add (must be positive)
 *     responses:
 *       200:
 *         description: Hours added successfully. Returns updated volunteer profile.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VolunteerProfileResponse'
 *             example:
 *               success: true
 *               message: "Added 4 hours. Total hours: 12."
 *               data:
 *                 _id: 64vol789xyz321
 *                 totalHours: 12
 *       400:
 *         description: Invalid hours value (non-positive or not a number).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Please provide a positive number for hours"
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Volunteer profile not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/volunteer/add-hours/:id', addVolunteerHours);

/**
 * @swagger
 * /api/admin/finances:
 *   get:
 *     summary: Get financial overview from all sponsors (Admin only)
 *     description: >
 *       Returns total amount raised from all sponsor donations, a tier breakdown
 *       (Gold/Silver/Bronze/Supporter counts), and the top 5 non-anonymous sponsors.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial summary retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRaised:
 *                       type: number
 *                       example: 12500
 *                     sponsorCount:
 *                       type: integer
 *                       example: 8
 *                     tierBreakdown:
 *                       type: object
 *                       properties:
 *                         Gold:
 *                           type: integer
 *                           example: 1
 *                         Silver:
 *                           type: integer
 *                           example: 2
 *                         Bronze:
 *                           type: integer
 *                           example: 3
 *                         Supporter:
 *                           type: integer
 *                           example: 2
 *                     topSponsors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Sponsor'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/finances', getFinances);

module.exports = router;
