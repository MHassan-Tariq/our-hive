const Sponsor = require('../models/Sponsor');

/**
 * @desc    Simulate a monetary donation and update tier
 * @route   POST /api/sponsor/donate
 * @access  Private (sponsor)
 */
const donate = async (req, res) => {
  try {
    const { amount, organizationName, isAnonymous } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive donation amount.',
      });
    }

    // Upsert sponsor profile and add to totalContributed
    let sponsor = await Sponsor.findOneAndUpdate(
      { userId: req.user._id },
      {
        $inc: { totalContributed: amount },
        $set: {
          ...(organizationName !== undefined && { organizationName }),
          ...(isAnonymous !== undefined && { isAnonymous }),
          userId: req.user._id,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Recalculate tier based on new total
    const newTier = Sponsor.getTier(sponsor.totalContributed);
    if (sponsor.tier !== newTier) {
      sponsor = await Sponsor.findByIdAndUpdate(
        sponsor._id,
        { tier: newTier },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: `Thank you! Your donation of $${amount} has been recorded.`,
      data: {
        totalContributed: sponsor.totalContributed,
        tier: sponsor.tier,
        tierUpgraded: sponsor.tier !== 'Supporter',
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors).map((e) => e.message),
      });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get sponsor impact summary
 * @route   GET /api/sponsor/impact
 * @access  Private (sponsor)
 */
const getImpact = async (req, res) => {
  try {
    const sponsor = await Sponsor.findOne({ userId: req.user._id });

    if (!sponsor) {
      return res.status(200).json({
        success: true,
        data: {
          totalContributed: 0,
          tier: 'Supporter',
          organizationName: null,
          isAnonymous: false,
          nextTierThreshold: 500,
          nextTier: 'Bronze',
          amountToNextTier: 500,
        },
      });
    }

    // Calculate progress to next tier
    const tierThresholds = { Bronze: 500, Silver: 1000, Gold: 5000 };
    const tierOrder = ['Supporter', 'Bronze', 'Silver', 'Gold'];
    const currentIndex = tierOrder.indexOf(sponsor.tier);
    const nextTier = tierOrder[currentIndex + 1] || null;
    const nextTierThreshold = nextTier ? tierThresholds[nextTier] : null;
    const amountToNextTier = nextTier
      ? Math.max(0, nextTierThreshold - sponsor.totalContributed)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalContributed: sponsor.totalContributed,
        tier: sponsor.tier,
        organizationName: sponsor.organizationName,
        isAnonymous: sponsor.isAnonymous,
        nextTier,
        nextTierThreshold,
        amountToNextTier,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { donate, getImpact };
