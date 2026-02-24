const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const ParticipantProfile = require('../models/ParticipantProfile');

/**
 * @desc    Upgrade from visitor to a specific role
 * @route   PATCH /api/user/select-role
 * @access  Private (Visitor only)
 */
exports.selectRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['volunteer', 'donor', 'sponsor', 'participant'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selection' });
    }

    if (req.user.role !== 'visitor') {
      return res.status(400).json({ success: false, message: 'User already has a specific role' });
    }

    // Update user role
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { role },
      { new: true }
    );

    // Create empty profile based on role
    switch (role) {
      case 'volunteer':
        await VolunteerProfile.create({ userId: user._id });
        break;
      case 'sponsor':
        await Sponsor.create({ userId: user._id });
        break;
      case 'participant':
        await ParticipantProfile.create({ userId: user._id });
        break;
      // 'donor' doesn't have a specific profile model yet, as it's linked via InKindDonation
    }

    res.status(200).json({
      success: true,
      message: `Role updated to ${role}`,
      data: user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
