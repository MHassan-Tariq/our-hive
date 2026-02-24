const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getDashboard,
  updatePartnerStatus,
  updateOpportunityStatus,
  addVolunteerHours,
  getFinances,
  getParticipantSummary,
} = require('../controllers/adminController');

// All routes here are admin only
router.use(protect);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all system users
 *     tags: [Admin]
 */
router.get('/users', getAllUsers);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin stats & pending actions
 *     tags: [Admin]
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/admin/partners/{id}/status:
 *   patch:
 *     summary: Approve or reject a partner organization
 *     tags: [Admin]
 */
router.patch('/partners/:id/status', updatePartnerStatus);

/**
 * @swagger
 * /api/admin/opportunities/{id}/status:
 *   patch:
 *     summary: Approve or reject a volunteer opportunity/event
 *     description: Admins review partner submissions before they go live.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Opportunity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, rejected]
 *     responses:
 *       200:
 *         description: Status updated successfully.
 */
router.patch('/opportunities/:id/status', updateOpportunityStatus);

/**
 * @swagger
 * /api/admin/volunteer/add-hours/{id}:
 *   patch:
 *     summary: Manually add hours to a volunteer profile
 *     tags: [Admin]
 */
router.patch('/volunteer/add-hours/:id', addVolunteerHours);

/**
 * @swagger
 * /api/admin/finances:
 *   get:
 *     summary: Get financial overview & top sponsors
 *     tags: [Admin]
 */
router.get('/finances', getFinances);

/**
 * @swagger
 * /api/admin/participants/summary:
 *   get:
 *     summary: Get participant summary (masked names)
 *     tags: [Admin]
 */
router.get('/participants/summary', getParticipantSummary);

module.exports = router;
