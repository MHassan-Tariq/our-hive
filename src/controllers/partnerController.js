const PartnerProfile = require('../models/PartnerProfile');
const Opportunity = require('../models/Opportunity');

/**
 * @desc    Submit or update partner onboarding profile
 * @route   POST /api/partners/profile
 * @access  Private (partner)
 */
const submitProfile = async (req, res) => {
  try {
    const { orgName, orgType, address, website, intendedRoles, agreements } =
      req.body;

    // Upsert: create if not exists, update if it does
    const profile = await PartnerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        orgName,
        orgType,
        address,
        website,
        intendedRoles,
        agreements,
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Partner profile submitted successfully. Pending admin review.',
      data: profile,
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
 * @desc    Get logged-in partner's own profile
 * @route   GET /api/partners/my-profile
 * @access  Private (partner)
 */
const getMyProfile = async (req, res) => {
  try {
    const profile = await PartnerProfile.findOne({
      userId: req.user._id,
    }).populate('userId', 'name email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'No partner profile found. Please complete your onboarding.',
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Create a new volunteer opportunity (approved partners only)
 * @route   POST /api/opportunities
 * @access  Private (partner)
 */
const createOpportunity = async (req, res) => {
  try {
    // ── Business Logic: only approved partners can post opportunities ──
    const profile = await PartnerProfile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(403).json({
        success: false,
        message:
          'No partner profile found. Please complete your onboarding first.',
      });
    }

    if (profile.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your organization is still pending admin approval.',
      });
    }

    const { title, description, location, date, category, requiredVolunteers } =
      req.body;

    const opportunity = await Opportunity.create({
      partnerId: req.user._id,
      title,
      description,
      location,
      date,
      category,
      requiredVolunteers,
    });

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully.',
      data: opportunity,
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
 * @desc    Get all opportunities created by the logged-in partner
 * @route   GET /api/opportunities/partner
 * @access  Private (partner)
 */
const getMyOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({
      partnerId: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  submitProfile,
  getMyProfile,
  createOpportunity,
  getMyOpportunities,
};
