const DonorProfile = require('../models/DonorProfile');
const Opportunity = require('../models/Opportunity');
const User = require('../models/User');
const MonetaryDonation = require('../models/MonetaryDonation');
const InKindDonation = require('../models/InKindDonation');
const PartnerProfile = require('../models/PartnerProfile');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendNotification } = require('../utils/notificationService');

/**
 * @desc    Get donor profile
 * @route   GET /api/donor/profile
 * @access  Private (Donor)
 */
const getDonorProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Get donor profile with joined events
  const profile = await DonorProfile.findOne({ userId })
    .populate('joinedEvents', 'title description date time location status category imageurl');

  if (!profile) {
    return next(new ErrorResponse('Donor profile not found', 404));
  }

  // Get user information
  const user = await User.findById(userId)
    .select('firstName lastName email phone profilePictureUrl mailingAddress preferences role isApproved createdAt');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get donation statistics
  const monetaryDonations = await MonetaryDonation.find({ sponsorId: userId });
  const inKindDonations = await InKindDonation.find({ donorId: userId });

  const totalMonetaryAmount = monetaryDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalMealsProvided = monetaryDonations.reduce((sum, d) => sum + (d.mealsProvided || 0), 0);
  const completedMonetary = monetaryDonations.filter(d => d.status === 'completed').length;
  const completedInKind = inKindDonations.filter(d => d.status === 'completed' || d.status === 'Delivered').length;

  // Combine profile data - minimal response
  const profileData = {
    profileImage: user.profilePictureUrl || null,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
    userId:user._id,
    address: user.mailingAddress,
    donorSince: user.createdAt,
    totalEventsJoined: profile.joinedEvents ? profile.joinedEvents.length : 0,
    totalDonations: monetaryDonations.length + inKindDonations.length,
  };

  res.status(200).json({
    success: true,
    data: profileData,
  });
});

/**
 * @desc    Update donor profile (monthly goal)
 * @route   PUT /api/donor/profile
 * @access  Private (Donor)
 */
const updateDonorProfile = asyncHandler(async (req, res, next) => {
  const { monthlyGoal } = req.body;

  const profile = await DonorProfile.findOneAndUpdate(
    { userId: req.user._id },
    { monthlyGoal },
    { new: true, runValidators: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Donor profile not found', 404));
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * @desc    Update user profile information
 * @route   PATCH /api/donor/profile/info
 * @access  Private (Donor)
 */
const updateUserProfile = asyncHandler(async (req, res, next) => {
  const { fullName, email, phone, address } = req.body;

  const updateData = {};

  // Handle fullName and split into firstName and lastName
  if (fullName !== undefined) {
    const nameParts = fullName.trim().split(" ").filter(Boolean);

    if (nameParts.length < 1) {
      return next(new ErrorResponse("Full name must contain at least one name", 400));
    }

    updateData.firstName = nameParts[0];
    updateData.lastName = nameParts.slice(1).join(" ") || "";
  }

  // Email update
  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return next(new ErrorResponse("Please provide a valid email address", 400));
    }

    updateData.email = email;
  }

  // Optional fields
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.mailingAddress = address;

  // Handle profile picture upload
  if (req.file) {
    updateData.profilePictureUrl = req.file.path; // Cloudinary URL
  }

  // Update user profile
  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select(
    "firstName lastName email phone profilePictureUrl mailingAddress preferences role isApproved createdAt"
  );

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  const profileData = {
    profileImage: user.profilePictureUrl || null,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
    address: user.mailingAddress,
    donorSince: user.createdAt,
  };

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profileData,
  });
});

/**
 * @desc    Get events joined by donor
 * @route   GET /api/donor/my-events
 * @access  Private (Donor)
 */
const getMyJoinedEvents = asyncHandler(async (req, res, next) => {
  const profile = await DonorProfile.findOne({ userId: req.user._id })
    .populate({
      path: 'joinedEvents',
      select: 'title description date time location status category imageurl',
      match: { status: { $in: ['Active', 'Completed'] } },
      options: { sort: { date: 1 } }
    });

  if (!profile) {
    return next(new ErrorResponse('Donor profile not found', 404));
  }

  res.status(200).json({
    success: true,
    count: profile.joinedEvents.length,
    data: profile.joinedEvents,
  });
});

/**
 * @desc    Join an event as a donor guest
 * @route   POST /api/donor/events/:id/join
 * @access  Private (Donor)
 */
const joinEventAsGuest = asyncHandler(async (req, res, next) => {
  // ensure donor role at controller level too
  if (req.user.role !== 'donor') {
    return next(new ErrorResponse('Only donors may join events as guests', 403));
  }

  const id = req.params.id;
  console.log('🔔 joinEventAsGuest called with event ID:', id);
  const opportunity = await Opportunity.findById(id);

  if (!opportunity) {
    return next(new ErrorResponse('Event not found', 404));
  }

  if (opportunity.status !== 'Active') {
    return next(new ErrorResponse(`This event is no longer active (status: ${opportunity.status})`, 400));
  }

  const userId = req.user._id;

  // Check if already joined
  const alreadyJoined = opportunity.attendees.some(
    (id) => id.toString() === userId.toString()
  );
  if (alreadyJoined) {
    return next(new ErrorResponse('You have already registered for this event', 400));
  }

  // For donors, we don't check capacity limits as they're guests
  opportunity.attendees.push(userId);
  await opportunity.save();

  // Update donor profile
  await DonorProfile.findOneAndUpdate(
    { userId },
    { $addToSet: { joinedEvents: opportunity._id } },
    { upsert: true }
  );

  // OneSignal Notification to Donor
  await sendNotification(
    userId,
    'Event Registration',
    `You are confirmed as a guest for "${opportunity.title}".`,
    'update',
    'checkmark'
  );

  res.status(200).json({
    success: true,
    message: `Successfully joined "${opportunity.title}" as a guest.`,
    data: {
      eventId: opportunity._id,
      title: opportunity.title,
      date: opportunity.date,
      time: opportunity.time,
      location: opportunity.location,
    },
  });
});

/**
 * @desc    Get all joined opportunities for a donor
 * @route   GET /api/donor/joined-opportunities
 * @access  Private (Donor)
 */
const getDonorJoinedOpportunities = asyncHandler(async (req, res, next) => {
  const { status, sortBy } = req.query;

  const profile = await DonorProfile.findOne({ userId: req.user._id });

  if (!profile) {
    return next(new ErrorResponse('Donor profile not found', 404));
  }

  let query = { _id: { $in: profile.joinedEvents } };

  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  // Get opportunities with full details
  let opportunities = await Opportunity.find(query)
    .populate('partnerId', 'firstName lastName email')
    .select('title description location whatToBring requirements date time endTime requiredVolunteers status category imageurl partnerId');

  // Add orgName from PartnerProfile for each opportunity
  for (let opportunity of opportunities) {
    if (opportunity.partnerId) {
      const partnerProfile = await PartnerProfile.findOne({ userId: opportunity.partnerId._id });
      if (partnerProfile) {
        opportunity.partnerId.orgName = partnerProfile.orgName;
      } else {
        opportunity.partnerId.orgName = "Our Hive Partner";
      }
    }
  }

  // Sort opportunities
  if (sortBy === 'oldest') {
    opportunities.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else {
    opportunities.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  res.status(200).json({
    success: true,
    count: opportunities.length,
    data: opportunities,
  });
});

/**
 * @desc    Leave an event
 * @route   DELETE /api/donor/events/:id/leave
 * @access  Private (Donor)
 */
const leaveEvent = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'donor') {
    return next(new ErrorResponse('Only donors may leave events via this endpoint', 403));
  }

  const opportunity = await Opportunity.findById(req.params.id);

  if (!opportunity) {
    return next(new ErrorResponse('Event not found', 404));
  }

  const userId = req.user._id;

  // Check if joined
  const isJoined = opportunity.attendees.some(
    (id) => id.toString() === userId.toString()
  );
  if (!isJoined) {
    return next(new ErrorResponse('You are not registered for this event', 400));
  }

  // Remove from attendees
  opportunity.attendees = opportunity.attendees.filter(
    (id) => id.toString() !== userId.toString()
  );
  await opportunity.save();

  // Remove from donor profile
  await DonorProfile.findOneAndUpdate(
    { userId },
    { $pull: { joinedEvents: opportunity._id } }
  );

  res.status(200).json({
    success: true,
    message: `Successfully left "${opportunity.title}".`,
  });
});

/**
 * @desc    Get all donations made by donor (Monetary & In-Kind)
 * @route   GET /api/donor/donations
 * @access  Private (Donor)
 */
const getDonations = asyncHandler(async (req, res, next) => {
  const { type, status, sortBy, search } = req.query;
  const userId = req.user._id;

  let monetaryDonations = [];
  let inKindDonations = [];

  // Create search regex if search provided
  const searchFilter = search
    ? { $regex: search, $options: "i" }
    : null;

  // Fetch monetary donations
  if (!type || type === "monetary") {
    let monQuery = { sponsorId: userId };

    if (status) monQuery.status = status;

    if (searchFilter) {
      monQuery.$or = [
        { projectTitle: searchFilter },v
      ];
    }

    monetaryDonations = await MonetaryDonation.find(monQuery)
      .populate("eventId", "title description")
      .sort(sortBy === "oldest" ? { date: 1 } : { date: -1 })
      .select(
        "_id sponsorId eventId projectTitle amount date status paymentMethod transactionId isMonthly mealsProvided"
      );
  }

  // Fetch in-kind donations
  if (!type || type === "in-kind") {
    let kindQuery = { donorId: userId };

    if (status) kindQuery.status = status;

    if (searchFilter) {
      kindQuery.$or = [
        { title: searchFilter },
        { itemName: searchFilter },
        { itemCategory: searchFilter },
        { description: searchFilter },
        { refId: searchFilter }
      ];
    }

    inKindDonations = await InKindDonation.find(kindQuery)
      .sort(sortBy === "oldest" ? { createdAt: 1 } : { createdAt: -1 })
      .select(
        "_id donorId donationId refId title itemName itemCategory description quantity pickupAddress estimatedValue status deliveryMethod pickupDate deliveredDate createdAt"
      );
  }

  // Format response
  const formattedMonetary = monetaryDonations.map((d) => ({
    ...(d.toObject ? d.toObject() : d),
    donationType: "monetary",
  }));

  const formattedInKind = inKindDonations.map((d) => {
    const donation = d.toObject ? d.toObject() : d;
    return {
      ...donation,
      address: donation.pickupAddress,
      pickupAddress: undefined,
      donationType: "in-kind",
    };
  });

  // Combine results
  let allDonations = [...formattedMonetary, ...formattedInKind];

  // Sort combined results if no specific type filter
  if (!type) {
    allDonations.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt);
      const dateB = new Date(b.date || b.createdAt);
      return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
    });
  }

  res.status(200).json({
    success: true,
    count: allDonations.length,
    monetaryCount: formattedMonetary.length,
    inKindCount: formattedInKind.length,
    data: allDonations,
  });
});

/**
 * @desc    Get monetary donations made by donor
 * @route   GET /api/donor/donations/monetary
 * @access  Private (Donor)
 */
const getMonetaryDonations = asyncHandler(async (req, res, next) => {
  const { status, sortBy } = req.query;
  const userId = req.user._id;

  let query = { sponsorId: userId };
  if (status) query.status = status;

  const donations = await MonetaryDonation.find(query)
    .populate('eventId', 'title description')
    .sort(sortBy === 'oldest' ? { date: 1 } : { date: -1 });

  res.status(200).json({
    success: true,
    count: donations.length,
    data: donations,
  });
});

/**
 * @desc    Get in-kind donations made by donor
 * @route   GET /api/donor/donations/in-kind
 * @access  Private (Donor)
 */
const getInKindDonations = asyncHandler(async (req, res, next) => {
  const { status, sortBy } = req.query;
  const userId = req.user._id;

  let query = { donorId: userId };
  if (status) query.status = status;

  const donations = await InKindDonation.find(query)
    .sort(sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
    .select('_id donorId donationId refId title itemName itemCategory description quantity pickupAddress estimatedValue status deliveryMethod pickupDate deliveredDate');

  // Rename pickupAddress to address
  const formattedDonations = donations.map(d => {
    const donation = d.toObject ? d.toObject() : d;
    return {
      ...donation,
      address: donation.pickupAddress,
      pickupAddress: undefined
    };
  });

  res.status(200).json({
    success: true,
    count: formattedDonations.length,
    data: formattedDonations,
  });
});

/**
 * @desc    Get donation details by ID
 * @route   GET /api/donor/donations/:id
 * @access  Private (Donor)
 */
const getDonationById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Try to find as monetary donation first
  let donation = await MonetaryDonation.findById(id).populate('eventId', 'title description');

  if (donation && donation.sponsorId.toString() !== userId.toString()) {
    return next(new ErrorResponse('Not authorized to view this donation', 403));
  }

  // If not found, try in-kind donation
  if (!donation) {
    donation = await InKindDonation.findById(id);
    if (donation && donation.donorId.toString() !== userId.toString()) {
      return next(new ErrorResponse('Not authorized to view this donation', 403));
    }
  }

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  // If it's an in-kind donation, rename pickupAddress to address
  let responseData = donation;
  if (donation.donorId) { // This indicates it's an in-kind donation
    const donationObj = donation.toObject ? donation.toObject() : donation;
    responseData = {
      ...donationObj,
      address: donationObj.pickupAddress,
      pickupAddress: undefined
    };
  }

  res.status(200).json({
    success: true,
    data: responseData,
  });
});

/**
 * @desc    Get donation statistics for donor
 * @route   GET /api/donor/donations/stats
 * @access  Private (Donor)
 */
const getDonationStats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Get monetary donations stats
  const monetaryDonations = await MonetaryDonation.find({ sponsorId: userId });
  const totalMonetaryAmount = monetaryDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalMealsProvided = monetaryDonations.reduce((sum, d) => sum + (d.mealsProvided || 0), 0);
  const completedMonetary = monetaryDonations.filter(d => d.status === 'completed').length;

  // Get in-kind donations stats
  const inKindDonations = await InKindDonation.find({ donorId: userId });
  const completedInKind = inKindDonations.filter(d => d.status === 'completed' || d.status === 'Delivered').length;

  res.status(200).json({
    success: true,
    data: {
      totalMonetaryDonations: monetaryDonations.length,
      totalMonetaryAmount,
      totalMealsProvided,
      completedMonetaryDonations: completedMonetary,
      totalInKindDonations: inKindDonations.length,
      completedInKindDonations: completedInKind,
      totalDonations: monetaryDonations.length + inKindDonations.length,
    },
  });
});

module.exports = {
  getDonorProfile,
  updateDonorProfile,
  updateUserProfile,
  getMyJoinedEvents,
  getDonorJoinedOpportunities,
  getDonations,
  getMonetaryDonations,
  getInKindDonations,
  getDonationById,
  getDonationStats,
  joinEventAsGuest,
  leaveEvent,
};