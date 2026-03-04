const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
  getAssignedDonations,
  getDonorDashboard,
  updateDonorProfile,
  updateDonation,
  getAllDonations,
  getInKindDonationById,
  ChangeDonationStatus
} = require('../controllers/donationController');
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/donations/all:
 *   get:
 *     summary: Get all in-kind donations (Public - no auth required)
 *     tags: [Donations]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by itemName or description.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Food, Clothing, Furniture, Electronics, Other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all donations.
 */
router.get('/all', getAllDonations);

/**
 * @swagger
 * /api/donations/{id}:
 *   get:
 *     summary: Get a specific in-kind donation by ID
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The donation ID
 *     responses:
 *       200:
 *         description: Donation details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *       404:
 *         description: Donation not found.
 */
router.get('/:id', getInKindDonationById);


/**
 * @swagger
 * /api/donations/status/{donationId}:
 *   patch:
 *     summary: Change donation status and update photo
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: donationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The donation ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               status: 
 *                 type: string
 *                 enum: [Available, Claimed, PickedUp]
 *               image: 
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Donation status updated successfully.
 *       400:
 *         description: Invalid status or transition.
 *       404:
 *         description: Donation not found.
 */
router.use(protect);

router.patch("/status/:donationId", upload.single('image'), ChangeDonationStatus);

/**
 * @swagger
 * /api/donations/dashboard:
 *   get:
 *     summary: Get donor dashboard overview (hybrid impact)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved.
 */
router.get('/dashboard', authorize('donor'), getDonorDashboard);

/**
 * @swagger
 * /api/donations/profile:
 *   patch:
 *     summary: Update donor profile settings (e.g. monthly goal)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monthlyGoal: { type: number, example: 85 }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
router.patch('/profile', authorize('donor'), updateDonorProfile);

/**
 * @swagger
 * /api/donations:
 *   post:
 *     summary: Offer a new in-kind donation (Donor only)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - itemName
 *               - itemCategory
 *               - description
 *             properties:
 *               itemName: { type: string, example: "10 Cases of Water" }
 *               itemCategory: { type: string, enum: [Food, Clothing, Furniture, Electronics, Other] }
 *               description: { type: string }
 *               quantity: { type: string }
 *               estimatedValue: { type: string, example: "$50" }
 *               deliveryMethod: { type: string, enum: [pickup, drop-off], example: "pickup" }
 *               additionalNotes: { type: string, example: "Gate code 1234" }
 *               petInfo:
 *                 type: string
 *                 description: JSON string of pet info object {hasCat, hasDog}.
 *               image: { type: string, format: binary }
 *               pickupAddress:
 *                 type: string
 *                 description: JSON string of address object {street, city, zip}.
 */
router.post('/', authorize('donor'), upload.single('image'), offerItem);

/**
 * @swagger
 * /api/donations/{id}:
 *   patch:
 *     summary: Update a pending in-kind donation offering (Donor only)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               itemName: { type: string }
 *               itemCategory: { type: string }
 *               description: { type: string }
 *               quantity: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Donation updated.
 */
router.patch('/:id', authorize('donor'), upload.single('image'), updateDonation);

/**
 * @swagger
 * /api/donations/my:
 *   get:
 *     summary: Get items I have offered
 *     tags: [Donations]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by itemName or refId.
 *     responses:
 *       200:
 *         description: List of my donations.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InKindDonation'
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
