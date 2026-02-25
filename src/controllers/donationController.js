const InKindDonation = require('../models/InKindDonation');
const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const DonorProfile = require('../models/DonorProfile');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Get donor dashboard overview
 * @route   GET /api/donations/dashboard
 * @access  Private (donor)
 */
const getDonorDashboard = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  
  // 1. Get Donations Made count
  const donationsCount = await InKindDonation.countDocuments({ donorId: req.user._id });

  // 2. Get Volunteer Hours
  const volunteerProfile = await VolunteerProfile.findOne({ userId: req.user._id });
  const hoursVolunteered = volunteerProfile ? volunteerProfile.totalHours : 0;

  // 3. Get Donor Profile (for monthly goal)
  let donorProfile = await DonorProfile.findOne({ userId: req.user._id });
  if (!donorProfile) {
    donorProfile = await DonorProfile.create({ userId: req.user._id });
  }

  const dashboardData = {
    greeting: `Hello, ${user.firstName || 'User'}!`,
    subHeader: "We are here to help you.",
    heroMessage: `Thanks You for YOUR Support, ${user.firstName || 'User'}!`,
    heroSubMessage: "Your Kindness is making a real difference in our community today.",
    impact: {
      hoursVolunteered: hoursVolunteered || 0,
      donationsMade: donationsCount || 0,
      monthlyGoal: donorProfile.monthlyGoal || 80,
    },
    quote: "Small acts, big changes."
  };

  res.status(200).json({
    success: true,
    data: dashboardData,
  });
});

/**
 * @desc    Offer an in-kind donation item
 * @route   POST /api/donations/offer
 * @access  Private (donor)
 */
const offerItem = asyncHandler(async (req, res, next) => {
  let { 
    itemName, 
    itemCategory, 
    description, 
    itemPhotoUrl, 
    pickupAddress, 
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo
  } = req.body;

  // Handle file upload
  if (req.file) {
    itemPhotoUrl = req.file.path;
  }

  // Handle stringified objects from multipart/form-data
  if (typeof pickupAddress === 'string') {
    try {
      pickupAddress = JSON.parse(pickupAddress);
    } catch (e) {}
  }
  if (typeof petInfo === 'string') {
    try {
      petInfo = JSON.parse(petInfo);
    } catch (e) {}
  }

  const donation = await InKindDonation.create({
    donorId: req.user._id,
    itemName,
    itemCategory,
    description,
    itemPhotoUrl,
    pickupAddress,
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo,
  });

  res.status(201).json({
    success: true,
    message: 'Item posted successfully. Volunteers will be notified.',
    data: donation,
  });
});

/**
 * @desc    Get all donations posted by the logged-in donor
 * @route   GET /api/donations/my-donations
 * @access  Private (donor)
 */
const getMyDonations = asyncHandler(async (req, res, next) => {
  const { search } = req.query;
  let query = { donorId: req.user._id };

  if (search) {
    query.$or = [
      { itemName: { $regex: search, $options: 'i' } },
      { refId: { $regex: search, $options: 'i' } },
    ];
  }

  const donations = await InKindDonation.find(query)
    .populate('assignedVolunteerId', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: donations.length,
    data: donations,
  });
});

/**
 * @desc    Get all available pickup items (status = 'offered')
 * @route   GET /api/donations/available-pickups
 * @access  Private (volunteer)
 */
const getAvailablePickups = asyncHandler(async (req, res, next) => {
  const donations = await InKindDonation.find({ status: 'offered' })
    .populate('donorId', 'name')
    .select('-pickupAddress')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: donations.length,
    data: donations,
  });
});

/**
 * @desc    Claim a donation item (volunteer picks it up)
 * @route   PATCH /api/donations/:id/claim
 * @access  Private (volunteer)
 */
const claimDonation = asyncHandler(async (req, res, next) => {
  const donation = await InKindDonation.findById(req.params.id);

  if (!donation) {
    return next(new ErrorResponse('Donation item not found.', 404));
  }

  if (donation.status !== 'offered') {
    return next(new ErrorResponse(`This item has already been claimed or is no longer available (status: ${donation.status}).`, 400));
  }

  donation.status = 'approved';
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
});

/**
 * @desc    Get donations assigned to the logged-in partner (recipient)
 * @route   GET /api/donations/assigned
 * @access  Private (partner)
 */
const getAssignedDonations = asyncHandler(async (req, res, next) => {
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
});

/**
 * @desc    Update donor profile (e.g. monthly goal)
 * @route   PATCH /api/donations/profile
 * @access  Private (donor)
 */
const updateDonorProfile = asyncHandler(async (req, res, next) => {
  const { monthlyGoal } = req.body;
  
  const donorProfile = await DonorProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { monthlyGoal } },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: donorProfile,
  });
});

/**
 * @desc    Update a pending in-kind donation
 * @route   PATCH /api/donations/:id
 * @access  Private (donor)
 */
const updateDonation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  let { 
    itemName, 
    itemCategory, 
    description, 
    pickupAddress, 
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo
  } = req.body;

  const donation = await InKindDonation.findOne({ _id: id, donorId: req.user._id });

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  if (donation.status !== 'pending') {
    return next(new ErrorResponse('Only pending donations can be edited', 400));
  }

  // Handle file upload
  if (req.file) {
    donation.itemPhotoUrl = req.file.path;
  }

  // Handle stringified objects from multipart/form-data
  if (typeof pickupAddress === 'string') {
    try { pickupAddress = JSON.parse(pickupAddress); } catch (e) {}
  }
  if (typeof petInfo === 'string') {
    try { petInfo = JSON.parse(petInfo); } catch (e) {}
  }

  donation.itemName = itemName || donation.itemName;
  donation.itemCategory = itemCategory || donation.itemCategory;
  donation.description = description || donation.description;
  donation.pickupAddress = pickupAddress || donation.pickupAddress;
  donation.quantity = quantity || donation.quantity;
  donation.estimatedValue = estimatedValue || donation.estimatedValue;
  donation.deliveryMethod = deliveryMethod || donation.deliveryMethod;
  donation.additionalNotes = additionalNotes || donation.additionalNotes;
  donation.petInfo = petInfo || donation.petInfo;

  await donation.save();

  res.status(200).json({
    success: true,
    message: 'Donation updated successfully',
    data: donation,
  });
});

module.exports = {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
  getAssignedDonations,
  getDonorDashboard,
  updateDonorProfile,
  updateDonation,
};
