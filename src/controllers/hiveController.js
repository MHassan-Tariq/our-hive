const ParticipantProfile = require('../models/ParticipantProfile');

/**
 * @desc    Redeem a digital voucher
 * @route   POST /api/hives/redeem-voucher
 * @access  Private (Partner/Admin)
 */
exports.redeemVoucher = async (req, res) => {
  try {
    const { qrCodeData } = req.body;

    if (!qrCodeData) {
      return res.status(400).json({ success: false, message: 'QR code data is required' });
    }

    // Find the participant with this specific active voucher
    const profile = await ParticipantProfile.findOne({
      'vouchers.qrCodeData': qrCodeData,
      'vouchers.status': 'active'
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Invalid or already redeemed voucher' });
    }

    // Update the specific voucher status
    const voucherIndex = profile.vouchers.findIndex(v => v.qrCodeData === qrCodeData);
    profile.vouchers[voucherIndex].status = 'redeemed';
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Voucher redeemed successfully',
      participantId: profile.userId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
