const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const Opportunity = require('../models/Opportunity');

/**
 * @desc    Get community impact statistics
 * @route   GET /api/public/stats
 * @access  Public
 */
exports.getStats = async (req, res) => {
  try {
    const totalBees = await User.countDocuments();
    const activeHives = await PartnerProfile.countDocuments({ status: 'approved' });
    
    const volunteerImpact = await VolunteerProfile.aggregate([
      { $group: { _id: null, totalHours: { $sum: '$totalHours' } } }
    ]);

    const financialSupport = await Sponsor.aggregate([
      { $group: { _id: null, totalRaised: { $sum: '$totalContributed' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBees,
        activeHives,
        volunteerImpact: volunteerImpact[0]?.totalHours || 0,
        financialSupport: financialSupport[0]?.totalRaised || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get all approved partners (Hives)
 * @route   GET /api/public/hives
 * @access  Public
 */
exports.getHives = async (req, res) => {
  try {
    const hives = await PartnerProfile.find({ status: 'approved' })
      .select('orgName orgType address website')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: hives.length,
      data: hives
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get all active opportunities
 * @route   GET /api/public/opportunities
 * @access  Public
 */
exports.getOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ status: 'active' })
      .select('title description location date category requiredVolunteers')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
