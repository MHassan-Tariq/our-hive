const InKindDonation = require('../models/InKindDonation');

/**
 * @desc    Offer an in-kind donation item
 * @route   POST /api/donations/offer
 * @access  Private (donor)
 */
const offerItem = async (req, res) => {
  try {
    const { itemCategory, description, itemPhotoUrl, pickupAddress, quantity } = req.body;

    const donation = await InKindDonation.create({
      donorId: req.user._id,
      itemCategory,
      description,
      itemPhotoUrl,
      pickupAddress,
      quantity,
    });

    res.status(201).json({
      success: true,
      message: 'Item posted successfully. Volunteers will be notified.',
      data: donation,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all donations posted by the logged-in donor
 * @route   GET /api/donations/my-donations
 * @access  Private (donor)
 */
const getMyDonations = async (req, res) => {
  try {
    const donations = await InKindDonation.find({ donorId: req.user._id })
      .populate('assignedVolunteerId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: donations.length,
      data: donations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all available pickup items (status = 'offered')
 * @route   GET /api/donations/available-pickups
 * @access  Private (volunteer)
 */
const getAvailablePickups = async (req, res) => {
  try {
    const donations = await InKindDonation.find({ status: 'offered' })
      .populate('donorId', 'name')
      .select('-pickupAddress')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: donations.length,
      data: donations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Claim a donation item (volunteer picks it up)
 * @route   PATCH /api/donations/:id/claim
 * @access  Private (volunteer)
 */
const claimDonation = async (req, res) => {
  try {
    const donation = await InKindDonation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation item not found.',
      });
    }

    if (donation.status !== 'offered') {
      return res.status(400).json({
        success: false,
        message: `This item has already been claimed or is no longer available (status: ${donation.status}).`,
      });
    }

    donation.status = 'claimed';
    donation.assignedVolunteerId = req.user._id;
    await donation.save();

    const populated = await InKindDonation.findById(donation._id)
      .populate('donorId', 'name email')
      .populate('assignedVolunteerId', 'name email');

    res.status(200).json({
      success: true,
      message: `Item claimed! Pickup address is now available.`,
      data: populated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get donations assigned to the logged-in partner (recipient)
 * @route   GET /api/donations/assigned
 * @access  Private (partner)
 */
const getAssignedDonations = async (req, res) => {
  try {
    const partnerId = req.user._id;
    const { status, search } = req.query;
    let query = { recipientId: partnerId };

    if (status) {
      if (status === 'pending') query.status = 'claimed';
      else if (status === 'in-transit') query.status = 'in-transit';
      else if (status === 'delivered') query.status = 'delivered';
      else query.status = status;
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { itemCategory: { $regex: search, $options: 'i' } },
      ];
    }

    const donations = await InKindDonation.find(query)
      .populate('donorId', 'name')
      .populate('assignedVolunteerId', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: donations.length,
      data: donations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
  getAssignedDonations,
};
