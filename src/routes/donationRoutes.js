const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
} = require('../controllers/donationController');

/**
 * @swagger
 * /api/donations/offer:
 *   post:
 *     summary: Post an in-kind donation item (Donors only)
 *     description: >
 *       Allows a donor to list an item for pickup. The full pickupAddress
 *       is stored but **hidden** from volunteers until they claim the item.
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemCategory
 *               - description
 *             properties:
 *               itemCategory:
 *                 type: string
 *                 enum: [Food, Clothing, Furniture, Electronics, Other]
 *                 example: Clothing
 *               description:
 *                 type: string
 *                 example: "10 boxes of winter jackets, various sizes"
 *               itemPhotoUrl:
 *                 type: string
 *                 example: "https://cdn.ourhive.com/items/jackets.jpg"
 *               pickupAddress:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "42 Defence Road"
 *                   city:
 *                     type: string
 *                     example: "Karachi"
 *                   zip:
 *                     type: string
 *                     example: "75500"
 *     responses:
 *       201:
 *         description: Item posted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InKindDonationResponse'
 *       400:
 *         description: Validation error.
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
 *         description: Forbidden — user is not a donor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/offer', protect, authorize('donor'), offerItem);

/**
 * @swagger
 * /api/donations/my-donations:
 *   get:
 *     summary: Get all items the donor has offered (Donors only)
 *     description: Returns all donation items posted by the logged-in donor, with assigned volunteer info if claimed.
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of donor's posted items.
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
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InKindDonation'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a donor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-donations', protect, authorize('donor'), getMyDonations);

/**
 * @swagger
 * /api/donations/available-pickups:
 *   get:
 *     summary: Get all unclaimed donation items (Volunteers only)
 *     description: >
 *       Returns all items with status `offered`. The `pickupAddress` field
 *       is **omitted** for privacy — it is only revealed after a volunteer claims
 *       the item via `PATCH /api/donations/:id/claim`.
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available items for pickup (no address included).
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
 *                   example: 4
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InKindDonation'
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
router.get(
  '/available-pickups',
  protect,
  authorize('volunteer'),
  getAvailablePickups
);

/**
 * @swagger
 * /api/donations/{id}/claim:
 *   patch:
 *     summary: Claim a donation item for pickup (Volunteers only)
 *     description: >
 *       Sets the item's `status` to `claimed` and assigns the volunteer as
 *       `assignedVolunteerId`. The **full pickupAddress is revealed** in the
 *       response for the first time after this call succeeds.
 *       Once claimed, the item **disappears** from `GET /available-pickups`.
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The InKindDonation `_id`
 *         example: 64don789abc123
 *     responses:
 *       200:
 *         description: Item claimed. Full pickupAddress is now in the response.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InKindDonationResponse'
 *             example:
 *               success: true
 *               message: "Item claimed! Pickup address is now available."
 *               data:
 *                 _id: "64don789abc123"
 *                 status: "claimed"
 *                 assignedVolunteerId:
 *                   _id: "64vol789xyz321"
 *                   name: "Ahmed Khan"
 *                 pickupAddress:
 *                   street: "42 Defence Road"
 *                   city: "Karachi"
 *                   zip: "75500"
 *       400:
 *         description: Item already claimed or not in 'offered' status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "This item has already been claimed or is no longer available (status: claimed)."
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
 *       404:
 *         description: Donation item not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id/claim', protect, authorize('volunteer'), claimDonation);

module.exports = router;
