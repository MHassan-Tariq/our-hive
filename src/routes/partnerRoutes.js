const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  submitProfile,
  getMyProfile,
  getDashboardData,
  createOpportunity,
  updateOpportunity,
  getMyOpportunities,
} = require('../controllers/partnerController');

// All partner profile routes require auth + partner role
router.use(protect);
router.use(authorize('partner'));

/**
 * @swagger
 * /api/partners/profile:
 *   post:
 *     summary: Submit or update partner organization profile
 *     description: >
 *       A partner submits their organization details and agreement confirmations.
 *       This endpoint uses **upsert** logic — re-submitting will update the existing profile.
 *       Profile status starts as `pending` until an admin approves.
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orgName
 *             properties:
 *               orgName:
 *                 type: string
 *                 example: Acme Community Foundation
 *               orgType:
 *                 type: string
 *                 example: Non-Profit Organization
 *               address:
 *                 type: string
 *                 example: 123 Main St, Karachi, Pakistan
 *               website:
 *                 type: string
 *                 example: 'https://acme.org'
 *               intendedRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Donating food", "Hosting events", "Mentoring youth"]
 *               agreements:
 *                 type: object
 *                 properties:
 *                   isAuthorized:
 *                     type: boolean
 *                     example: true
 *                   agreedToTerms:
 *                     type: boolean
 *                     example: true
 *                   understandOperationalControl:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Profile submitted successfully. Awaiting admin review.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerProfileResponse'
 *       400:
 *         description: Validation error (e.g., missing orgName).
 */
router.post('/profile', submitProfile);

/**
 * @swagger
 * /api/partners/my-profile:
 *   get:
 *     summary: Get logged-in partner's own profile
 *     tags: [Partners]
 */
router.get('/my-profile', getMyProfile);

/**
 * @swagger
 * /api/partners/dashboard:
 *   get:
 *     summary: Get partner dashboard overview
 *     tags: [Partners]
 */
router.get('/dashboard', getDashboardData);

/**
 * @swagger
 * /api/opportunities:
 *   post:
 *     summary: Create a new volunteer opportunity or event (Partner only)
 *     tags: [Partners, Opportunities]
 */
router.post('/opportunities', createOpportunity);

/**
 * @swagger
 * /api/opportunities/partner:
 *   get:
 *     summary: Get all opportunities created by the logged-in partner
 *     description: Retrieve list of events and volunteer opportunities. Supports optional search and status filtering.
 *     tags: [Partners, Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, rejected, completed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search within title or description
 *     responses:
 *       200:
 *         description: List of opportunities retrieved.
 */
router.get('/opportunities/partner', getMyOpportunities);

/**
 * @swagger
 * /api/opportunities/{id}:
 *   patch:
 *     summary: Update an existing opportunity (Partner only)
 *     description: Allows partners to edit their submissions. Status will revert to 'pending' after edit.
 *     tags: [Partners, Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Opportunity'
 *     responses:
 *       200:
 *         description: Opportunity updated successfully.
 */
router.patch('/opportunities/:id', updateOpportunity);

module.exports = router;
