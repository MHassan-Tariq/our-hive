const Sponsor = require('../models/Sponsor');
const MonetaryDonation = require('../models/MonetaryDonation');
const InKindDonation = require('../models/InKindDonation');
const ActivityLog = require('../models/ActivityLog');
const Campaign = require('../models/Campaign');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Simulate a monetary donation and update tier
 * @route   POST /api/sponsor/donate
 * @access  Private (sponsor)
 */
const donate = asyncHandler(async (req, res, next) => {
  let {
    amount,
    organizationName,
    isAnonymous,
    projectTitle,
    paymentMethod,
    isMonthly,
    campaignId,
  } = req.body;

  // Convert string amount to number if necessary (common in multipart forms)
  if (typeof amount === 'string') {
    amount = parseFloat(amount);
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return next(new ErrorResponse('Please provide a valid positive donation amount.', 400));
  }

  // Handle file upload
  let logoUrl = req.body.logoUrl;
  if (req.file) {
    logoUrl = `/uploads/${req.file.filename}`;
  }

  // 1. Create Monetary Donation record
  const mealsProvided = Math.floor(amount / 2.5);
  const transaction = await MonetaryDonation.create({
    sponsorId: req.user._id,
    campaignId: campaignId || null,
    projectTitle: projectTitle || 'General Support',
    amount,
    mealsProvided,
    paymentMethod: paymentMethod || 'Credit Card',
    isMonthly: !!isMonthly,
    status: 'completed',
  });

  // 2. Upsert sponsor profile and add to totalContributed
  let sponsor = await Sponsor.findOneAndUpdate(
    { userId: req.user._id },
    {
      $inc: { totalContributed: amount },
      $set: {
        ...(organizationName !== undefined && { organizationName }),
        ...(isAnonymous !== undefined && { isAnonymous }),
        ...(logoUrl !== undefined && { logoUrl }),
        isMonthlySupporter: !!isMonthly,
        subscriptionInterval: isMonthly ? 'monthly' : 'once',
        userId: req.user._id,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  // 3. Recalculate tier based on new total
  const newTier = Sponsor.getTier(sponsor.totalContributed);
  if (sponsor.tier !== newTier) {
    sponsor = await Sponsor.findByIdAndUpdate(
      sponsor._id,
      { tier: newTier },
      { new: true }
    );
  }

  // 4. Activity Log
  await ActivityLog.create({
    userId: req.user._id,
    type: 'New Monetary Donation',
    content: `You donated $${amount} (${mealsProvided} meals) to ${
      projectTitle || 'Our Hive'
    }${isMonthly ? ' as a monthly supporter' : ''}.`,
    relatedId: transaction._id,
    relatedModel: 'MonetaryDonation',
  });

  res.status(200).json({
    success: true,
    message: `Thank you! Your ${
      isMonthly ? 'monthly ' : ''
    }donation of $${amount} has been recorded.`,
    data: {
      totalContributed: sponsor.totalContributed,
      tier: sponsor.tier,
      mealsProvided,
      transaction,
    },
  });
});

/**
 * @desc    Initiate a donation and get portal URL (for Page 6 "Secure Donation")
 * @route   POST /api/sponsor/donations/initiate
 * @access  Private (sponsor)
 */
const initiateDonation = asyncHandler(async (req, res, next) => {
  const { amount, campaignId, projectTitle, isMonthly } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return next(new ErrorResponse('Please provide a valid positive donation amount.', 400));
  }

  // Create a pending transaction
  const transaction = await MonetaryDonation.create({
    sponsorId: req.user._id,
    campaignId: campaignId || null,
    projectTitle: projectTitle || 'General Support',
    amount,
    isMonthly: !!isMonthly,
    status: 'pending',
  });

  // Find campaign to get its specific donation URL if available
  let portalUrl = 'https://zeffy.com/donation-portal'; // Default fallback
  if (campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (campaign && campaign.externalDonationUrl) {
      portalUrl = campaign.externalDonationUrl;
    }
  }

  res.status(200).json({
    success: true,
    message: 'Donation initiated successfully. Redirecting to secure portal...',
    data: {
      transactionId: transaction._id,
      redirectUrl: portalUrl,
    },
  });
});

/**
 * @desc    Get aggregate mission impact stats for the "Support Our Mission" screen
 * @route   GET /api/sponsor/mission-stats
 * @access  Public (or Private)
 */
const getMissionStats = asyncHandler(async (req, res, next) => {
  // In a real app, these would be aggregated from the database
  // For now, returning data that matches the UI image
  res.status(200).json({
    success: true,
    data: {
      mealsServed: "1.2k+",
      familiesHelped: 450,
      activeHubs: 15,
      missionStatement: "Your contribution helps us provide meals, resources, and support to our community. Every \"honeycomb\" in our hive makes us stronger."
    }
  });
});

/**
 * @desc    Get sponsor dashboard data (stats + donations)
 * @route   GET /api/sponsor/dashboard
 * @access  Private (sponsor)
 */
const getSponsorDashboard = asyncHandler(async (req, res, next) => {
  const sponsorId = req.user._id;

  // 1. Get Sponsor Profile
  const profile = await Sponsor.findOne({ userId: sponsorId });

  // 2. Get Monetary Donations List
  const monetaryDonations = await MonetaryDonation.find({ sponsorId }).sort({
    date: -1,
  });

  // 3. Get In-Kind Donations Count
  const inKindCount = await InKindDonation.countDocuments({ donorId: sponsorId });

  // 4. Calculate total meals provided
  const totalMealsProvided = monetaryDonations.reduce((acc, d) => acc + (d.mealsProvided || 0), 0);

  res.status(200).json({
    success: true,
    data: {
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        profilePictureUrl: req.user.profilePictureUrl,
      },
      stats: {
        totalSupport: profile ? profile.totalContributed : 0,
        activeContributions: inKindCount + monetaryDonations.length,
        totalMealsProvided,
        tier: profile ? profile.tier : 'Supporter',
        isMonthlySupporter: profile ? profile.isMonthlySupporter : false
      },
      monetaryDonations,
    },
  });
});

/**
 * @desc    Get sponsor impact summary
 * @route   GET /api/sponsor/impact
 * @access  Private (sponsor)
 */
const getImpact = asyncHandler(async (req, res, next) => {
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
});

/**
 * @desc    Get all active fundraising campaigns
 * @route   GET /api/sponsor/campaigns
 * @access  Private (sponsor)
 */
const getCampaigns = asyncHandler(async (req, res, next) => {
  const { category } = req.query;
  const query = { isActive: true };

  if (category && category !== 'All') {
    query.category = category;
  }

  const campaigns = await Campaign.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: campaigns.length,
    data: campaigns,
  });
});

/**
 * @desc    Update sponsor organization profile
 * @route   PATCH /api/sponsor/profile
 * @access  Private (sponsor)
 */
const updateSponsorProfile = asyncHandler(async (req, res, next) => {
  const { organizationName, isAnonymous } = req.body;
  const updateData = {};

  if (organizationName !== undefined) updateData.organizationName = organizationName;
  if (isAnonymous !== undefined) updateData.isAnonymous = isAnonymous === 'true' || isAnonymous === true;

  if (req.file) {
    updateData.logoUrl = req.file.path;
  }

  const sponsor = await Sponsor.findOneAndUpdate(
    { userId: req.user._id },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!sponsor) {
    return next(new ErrorResponse('Sponsor profile not found', 404));
  }

  // Activity Log
  await ActivityLog.create({
    userId: req.user._id,
    type: 'Profile Updated',
    content: 'You updated your sponsor organization profile.',
    relatedId: sponsor._id,
    relatedModel: 'Sponsor',
  });

  res.status(200).json({
    success: true,
    data: sponsor,
  });
});

module.exports = {
  donate,
  initiateDonation,
  getSponsorDashboard,
  getImpact,
  getMissionStats,
  getCampaigns,
  updateSponsorProfile,
};
