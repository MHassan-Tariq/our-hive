const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { saveProfile, getMyFeed, requestService } = require('../controllers/participantController');

router.use(protect);
router.use(authorize('participant'));

/**
 * @swagger
 * /api/participant/profile:
 *   post:
 *     summary: Save or update participant profile
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Food Security", "Health"]
 *               residenceArea:
 *                 type: string
 *                 example: "Clifton, Karachi"
 *     responses:
 *       200:
 *         description: Profile saved successfully
 */
router.post('/profile', saveProfile);

/**
 * @swagger
 * /api/participant/my-feed:
 *   get:
 *     summary: Get personalized feed of opportunities and donations
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of matching services
 */
router.get('/my-feed', getMyFeed);

/**
 * @swagger
 * /api/participant/request-service/{id}:
 *   post:
 *     summary: Request a service/item and generate a digital voucher
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Voucher generated
 */
router.post('/request-service/:id', requestService);

module.exports = router;
