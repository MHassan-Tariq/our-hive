const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  submitProfile,
  getMyProfile,
} = require('../controllers/partnerController');

// All partner profile routes require auth + partner role
router.use(protect);
router.use(authorize('partner'));

/**
 * @swagger
 * /api/partners/profile:
 *   post:
 *     summary: Submit or update partner onboarding profile
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
 *                 example: https://acme.org
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
 *     responses:
 *       200:
 *         description: Profile submitted successfully. Awaiting admin review.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerProfileResponse'
 *       400:
 *         description: Validation error (e.g., missing orgName).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — no or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a partner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/profile', submitProfile);

/**
 * @swagger
 * /api/partners/my-profile:
 *   get:
 *     summary: Get logged-in partner's own profile
 *     description: Returns the partner's organization data including current approval status.
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerProfileResponse'
 *       401:
 *         description: Unauthorized — no or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a partner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No profile found. Partner has not submitted onboarding yet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-profile', getMyProfile);

module.exports = router;
