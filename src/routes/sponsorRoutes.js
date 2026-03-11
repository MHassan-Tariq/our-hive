const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  donate,
  initiateDonation,
  getSponsorDashboard,
  getImpact,
  getCampaigns,
  updatePersonalInfo,
  updateSponsorProfile,
} = require('../controllers/sponsorController');

router.use(protect);
router.use(authorize('sponsor'));

/**
 * @swagger
 * /api/sponsor/donations/initiate:
 *   post:
 *     summary: Initiate a donation session (Sponsor only)
 *     description: Creates a pending donation record and returns a redirect URL to the secure portal (Page 6).
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount: { type: number, example: 100 }
 *               campaignId: { type: string, example: "653b8f..." }
 *               projectTitle: { type: string, example: "Clean Water" }
 *               isMonthly: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Donation initiated. Returns the secure portal URL.
 */
router.post('/donations/initiate', initiateDonation);

/**
 * @swagger
 * /api/sponsor/campaigns:
 *   get:
 *     summary: Get all fundraising campaigns (Sponsor only)
 *     description: Returns a list of active campaigns, optionally filtered by category.
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [All, Water, Education, Health]
 *         description: Category to filter by
 *     responses:
 *       200:
 *         description: List of campaigns retrieved.
 */
router.get('/campaigns', getCampaigns);

/**
 * @swagger
 * /api/sponsor/dashboard:
 *   get:
 *     summary: Get sponsor dashboard data (Sponsor only)
 *     description: Returns user profile, total support, active contributions count, and list of monetary donations.
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SponsorDashboardResponse'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a sponsor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', getSponsorDashboard);

/**
 * @swagger
 * /api/sponsor/donate:
 *   post:
 *     summary: Record a monetary donation (Sponsors only)
 *     description: >
 *       Simulates receiving a donation payment. Atomically increases
 *       `totalContributed` and automatically upgrades the sponsor's `tier`.
 *       Also creates a `MonetaryDonation` transaction record with meal calculation
 *       ($2.50 provides 1 meal).
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 example: 750
 *                 description: Donation amount in USD
 *               projectTitle:
 *                 type: string
 *                 example: "Meal Distribution"
 *                 description: The title of the project the donation is for.
 *               paymentMethod:
 *                 type: string
 *                 example: "Credit Card"
 *                 description: The method used for the payment.
 *               organizationName:
 *                 type: string
 *                 example: Acme Corp
 *               isAnonymous:
 *                 type: boolean
 *                 example: false
 *               isMonthly:
 *                 type: boolean
 *                 description: Set to true if this is a recurring monthly donation.
 *               campaignId:
 *                 type: string
 *                 description: The ID of the campaign being supported.
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Donation recorded.
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
 *                     totalContributed:
 *                       type: number
 *                       example: 750
 *                     tier:
 *                       type: string
 *                       enum: [Supporter, Bronze, Silver, Gold]
 *                       example: Bronze
 *                     tierUpgraded:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid amount.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a sponsor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/donate', donate);

/**
 * @swagger
 * /api/sponsor/impact:
 *   get:
 *     summary: Get sponsor impact summary (Sponsors only)
 *     description: >
 *       Returns the sponsor's total contributions, current tier badge, and
 *       progress to the next tier — ideal for a gamified dashboard screen.
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sponsor impact data retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SponsorImpactResponse'
 *             example:
 *               success: true
 *               data:
 *                 totalContributed: 750
 *                 tier: Bronze
 *                 organizationName: "Acme Corp"
 *                 isAnonymous: false
 *                 nextTier: Silver
 *                 nextTierThreshold: 1000
 *                 amountToNextTier: 250
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a sponsor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/impact', getImpact);

/**
 * @swagger
 * /api/sponsor/account:
 *   patch:
 *     summary: Update sponsor personal information
 *     tags: [Sponsors]
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
 *               email: { type: string, format: email, example: "john@example.com" }
 *               phone: { type: string, example: "(555) 123-4567" }
 *               profilePictureUrl: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Personal information updated.
 */
router.patch('/profile', upload.single('profilePictureUrl'), updatePersonalInfo);

/**
 * @swagger
 * /api/sponsor/profile:
 *   patch:
 *     summary: Update sponsor organization profile
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName: { type: string }
 *               isAnonymous: { type: boolean }
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
router.patch('/profile', upload.single('logo'), updateSponsorProfile);

module.exports = router;
