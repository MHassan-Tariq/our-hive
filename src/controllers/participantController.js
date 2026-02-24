const ParticipantProfile = require('../models/ParticipantProfile');
const Opportunity = require('../models/Opportunity');
const InKindDonation = require('../models/InKindDonation');
const crypto = require('crypto');

/**
 * @desc    Save/Update Participant Profile
 * @route   POST /api/participant/profile
 * @access  Private (Participant)
 */
exports.saveProfile = async (req, res) => {
  try {
    const { interests, residenceArea } = req.body;

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { interests, residenceArea },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get Personalized Feed
 * @route   GET /api/participant/my-feed
 * @access  Private (Participant)
 */
exports.getMyFeed = async (req, res) => {
  try {
    const profile = await ParticipantProfile.findOne({ userId: req.user._id });
    const interests = profile ? profile.interests : [];

    // Find matching opportunities
    const opportunities = await Opportunity.find({
      status: 'active',
      category: { $in: interests }
    }).sort({ createdAt: -1 });

    // Find matching donations
    const donations = await InKindDonation.find({
      status: 'offered',
      itemCategory: { $in: interests }
    }).sort({ createdAt: -1 });

    // Combine and sort
    const feed = [...opportunities.map(o => ({ ...o._doc, type: 'opportunity' })), 
                  ...donations.map(d => ({ ...d._doc, type: 'donation' }))]
                  .sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      success: true,
      count: feed.length,
      data: feed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Request service and generate voucher
 * @route   POST /api/participant/request-service/:id
 * @access  Private (Participant)
 */
exports.requestService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    
    // Check if it's an opportunity or donation
    let service = await Opportunity.findById(serviceId);
    let serviceType = 'Opportunity';
    
    if (!service) {
      service = await InKindDonation.findById(serviceId);
      serviceType = 'InKindDonation';
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Generate unique hash for QR code
    const qrCodeData = crypto.createHash('sha256')
      .update(`${req.user._id}-${serviceId}-${Date.now()}`)
      .digest('hex');

    const voucher = {
      serviceId,
      serviceType,
      qrCodeData,
      status: 'active'
    };

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { vouchers: voucher } },
      { new: true, upsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Voucher generated successfully',
      data: profile.vouchers[profile.vouchers.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
