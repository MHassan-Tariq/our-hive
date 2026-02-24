const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { donate, getImpact } = require('../controllers/sponsorController');

router.use(protect);
router.use(authorize('sponsor'));

/**
 * @swagger
 * /api/sponsor/donate:
 *   post:
 *     summary: Record a monetary donation (Sponsors only)
 *     description: >
 *       Simulates receiving a donation payment. Atomically increases
 *       `totalContributed` and automatically upgrades the sponsor's `tier`:
 *       - **$0–499** → Supporter
 *       - **$500–999** → Bronze
 *       - **$1,000–4,999** → Silver
 *       - **$5,000+** → Gold
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
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 example: 750
 *                 description: Donation amount in USD
 *               organizationName:
 *                 type: string
 *                 example: Acme Corp
 *               isAnonymous:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Donation recorded and tier recalculated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Thank you! Your donation of $750 has been recorded."
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

module.exports = router;
