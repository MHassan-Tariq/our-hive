const express = require('express');
const router = express.Router();
const {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
  getAssignedDonations,
} = require('../controllers/donationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

/**
 * @swagger
 * /api/donations:
 *   post:
 *     summary: Offer a new in-kind donation (Donor only)
 *     tags: [Donations]
 */
router.post('/', authorize('donor'), offerItem);

/**
 * @swagger
 * /api/donations/my:
 *   get:
 *     summary: Get items I have offered
 *     tags: [Donations]
 */
router.get('/my', authorize('donor'), getMyDonations);

/**
 * @swagger
 * /api/donations/available:
 *   get:
 *     summary: Get all items available for pickup (Volunteer only)
 *     tags: [Donations]
 */
router.get('/available', authorize('volunteer'), getAvailablePickups);

/**
 * @swagger
 * /api/donations/{id}/claim:
 *   post:
 *     summary: Claim an item for pickup (Volunteer only)
 *     tags: [Donations]
 */
router.post('/:id/claim', authorize('volunteer'), claimDonation);

/**
 * @swagger
 * /api/donations/assigned:
 *   get:
 *     summary: Get donations assigned to this organization (Partner only)
 *     description: Shows items being delivered to the partner. Supports status filter (pending, in-transit, delivered).
 *     tags: [Partners, Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-transit, delivered]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned donations.
 */
router.get('/assigned', authorize('partner'), getAssignedDonations);

module.exports = router;
