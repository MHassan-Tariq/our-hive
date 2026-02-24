const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { redeemVoucher } = require('../controllers/hiveController');

router.use(protect);
router.use(authorize('partner', 'admin'));

/**
 * @swagger
 * /api/hives/redeem-voucher:
 *   post:
 *     summary: Redeem a participant's digital voucher (Partner/Admin scanner)
 *     tags: [Hives]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrCodeData
 *             properties:
 *               qrCodeData:
 *                 type: string
 *                 description: The secure hash from the QR code
 *     responses:
 *       200:
 *         description: Voucher redeemed successfully
 *       404:
 *         description: Voucher invalid or already redeemed
 */
router.post('/redeem-voucher', redeemVoucher);

module.exports = router;
