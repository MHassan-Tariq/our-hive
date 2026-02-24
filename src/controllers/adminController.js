const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');

const ROLES = [
  'visitor',
  'participant',
  'volunteer',
  'donor',
  'sponsor',
  'partner',
  'admin',
];

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin only)
 */
const getDashboard = async (req, res) => {
  try {
    // Count users per role
    const roleCountsArr = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // Convert to a clean object, ensuring all roles are present
    const roleCounts = ROLES.reduce((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {});
    roleCountsArr.forEach(({ _id, count }) => {
      roleCounts[_id] = count;
    });

    // Get pending partner approvals
    const pendingPartners = await User.find({
      role: 'partner',
      isApproved: false,
    }).select('-__v');

    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        roleCounts,
        pendingPartners,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Update a partner's approval status
 * @route   PATCH /api/admin/partners/:id/status
 * @access  Private (Admin only)
 * :id — the PartnerProfile document _id
 */
const updatePartnerStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'",
      });
    }

    const profile = await PartnerProfile.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Partner profile not found',
      });
    }

    // Keep User.isApproved in sync for the dashboard query
    await User.findByIdAndUpdate(profile.userId, {
      isApproved: status === 'approved',
    });

    res.status(200).json({
      success: true,
      message: `Partner status updated to '${status}'.`,
      data: profile,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Add hours to a volunteer's totalHours
 * @route   PATCH /api/admin/volunteer/add-hours/:id
 * @access  Private (Admin only)
 * :id — the VolunteerProfile document _id
 */
const addVolunteerHours = async (req, res) => {
  try {
    const { hours } = req.body;

    if (!hours || typeof hours !== 'number' || hours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a positive number for hours',
      });
    }

    const profile = await VolunteerProfile.findByIdAndUpdate(
      req.params.id,
      { $inc: { totalHours: hours } }, // atomic increment
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer profile not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Added ${hours} hours. Total hours: ${profile.totalHours}.`,
      data: profile,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get financial overview — total raised from all sponsors
 * @route   GET /api/admin/finances
 * @access  Private (Admin only)
 */
const getFinances = async (req, res) => {
  try {
    const [aggregate] = await Sponsor.aggregate([
      {
        $group: {
          _id: null,
          totalRaised: { $sum: '$totalContributed' },
          sponsorCount: { $sum: 1 },
          goldCount: { $sum: { $cond: [{ $eq: ['$tier', 'Gold'] }, 1, 0] } },
          silverCount: { $sum: { $cond: [{ $eq: ['$tier', 'Silver'] }, 1, 0] } },
          bronzeCount: { $sum: { $cond: [{ $eq: ['$tier', 'Bronze'] }, 1, 0] } },
        },
      },
    ]);

    const topSponsors = await Sponsor.find({ isAnonymous: false })
      .sort({ totalContributed: -1 })
      .limit(5)
      .populate('userId', 'name email');

    res.status(200).json({
      success: true,
      data: {
        totalRaised: aggregate?.totalRaised ?? 0,
        sponsorCount: aggregate?.sponsorCount ?? 0,
        tierBreakdown: {
          Gold: aggregate?.goldCount ?? 0,
          Silver: aggregate?.silverCount ?? 0,
          Bronze: aggregate?.bronzeCount ?? 0,
          Supporter: (aggregate?.sponsorCount ?? 0) -
            (aggregate?.goldCount ?? 0) -
            (aggregate?.silverCount ?? 0) -
            (aggregate?.bronzeCount ?? 0),
        },
        topSponsors,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get summary of all participants (masked names for privacy)
 * @route   GET /api/admin/participants/summary
 * @access  Private (Admin only)
 */
const getParticipantSummary = async (req, res) => {
  try {
    const users = await User.find({ role: 'participant' }).select('name email role createdAt');
    
    // Mask names: "John Doe" -> "John D."
    const maskedUsers = users.map(user => {
      const parts = user.name.split(' ');
      const maskedName = parts.length > 1 
        ? `${parts[0]} ${parts[1][0]}.` 
        : user.name;
        
      return {
        ...user._doc,
        name: maskedName
      };
    });

    res.status(200).json({
      success: true,
      count: maskedUsers.length,
      data: maskedUsers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllUsers, getDashboard, updatePartnerStatus, addVolunteerHours, getFinances, getParticipantSummary };
