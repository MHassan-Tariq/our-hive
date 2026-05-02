const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const InKindDonation = require('../models/InKindDonation');
const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const DonorProfile = require('../models/DonorProfile');
const Sponsor = require('../models/Sponsor');
const MonetaryDonation = require('../models/MonetaryDonation');
const { sendNotification } = require('../utils/notificationService');
const mongoose = require('mongoose');

// Shared Color Palette for Statuses
const statusColors = {
  approved: '#22c55e', // Green
  scheduled: '#3b82f6', // Blue
  completed: '#6b7280', // Grey
  pickedup: '#6b7280', // Grey
  delivered: '#6b7280', // Grey
  rejected: '#ef4444', // Red
  pending: '#f97316', // Orange
  offered: '#eab308', // Yellow/Gold
  claimed: '#eab308',  // Yellow/Gold
  'picked up': '#6b7280' // Grey
};

// Shared Capitalization Utility
const capitalize = (s) => {
  if (!s) return '';
  if (s.toLowerCase() === 'pickedup') return 'Picked Up';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * @desc    Post an in-kind donation offer
 * @route   POST /api/donations/offer
 * @access  Private (donor)
 */
const offerItem = asyncHandler(async (req, res, next) => {
  const {
    title,
    category,
    description,
    pickupAddress,
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo,
  } = req.body;

  let parsedAddress = pickupAddress;
  if (typeof pickupAddress === 'string') {
    try { parsedAddress = JSON.parse(pickupAddress); } catch (e) {}
  }

  const donation = await InKindDonation.create({
    donorId: req.user._id,
    itemName: title,
    itemCategory: category,
    description,
    pickupAddress: parsedAddress,
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo: typeof petInfo === 'string' ? JSON.parse(petInfo) : petInfo,
    image: req.file ? req.file.path : null,
    status: 'pending',
  });

  try {
    await sendNotification(
      req.user._id,
      'Donation Offer Received',
      `Thank you! Your donation offer for "${title}" has been received and is pending review.`,
      'update',
      'checkmark'
    );
  } catch (err) {
    console.error('Notification Error:', err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Item posted successfully. Volunteers will be notified.',
    data: donation,
  });
});

/**
 * @desc    Get all donations posted by the logged-in donor
 */
const getMyDonations = asyncHandler(async (req, res, next) => {
  const { search } = req.query;
  let query = { donorId: req.user._id };

  if (search) {
    query.$or = [{ itemName: { $regex: search, $options: 'i' } }, { refId: { $regex: search, $options: 'i' } }];
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await InKindDonation.countDocuments(query);
  const donations = await InKindDonation.find(query)
    .populate('assignedVolunteerId', 'firstName lastName email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    let dbStatus = (donationObj.status || 'offered').toLowerCase();
    if (dbStatus === 'available') dbStatus = 'offered';
    
    const displayLabel = capitalize(dbStatus);

    donationObj.status = displayLabel;
    donationObj.displayStatus = displayLabel;
    donationObj.statusLabel = displayLabel;
    donationObj.statusColor = statusColors[dbStatus] || '#A16D36';
    donationObj.isClaimed = !!donation.assignedVolunteerId;
    donationObj.isApproved = ['approved', 'scheduled', 'completed', 'pickedup', 'delivered'].includes(dbStatus);
    donationObj.isRejected = dbStatus === 'rejected';
    const isMine = !!(donation.assignedVolunteerId && req.user && 
                   (donation.assignedVolunteerId._id ? donation.assignedVolunteerId._id.equals(req.user._id) : donation.assignedVolunteerId.equals(req.user._id)));
    donationObj.claimedByMe = isMine;
    
    return donationObj;
  });

  const [pendingCount, claimedCount, approvedCount] = await Promise.all([
    InKindDonation.countDocuments({ status: 'pending' }),
    InKindDonation.countDocuments({ status: 'claimed' }),
    InKindDonation.countDocuments({ status: 'approved' })
  ]);

  res.status(200).json({ 
    success: true, 
    count: transformedDonations.length, 
    stats: {
      pendingCount,
      claimedCount,
      approvedCount,
      totalCount: total
    },
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      count: transformedDonations.length
    },
    data: transformedDonations 
  });
});

/**
 * @desc    Get all available pickup items
 */
const getAvailablePickups = asyncHandler(async (req, res, next) => {
  const query = {};
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await InKindDonation.countDocuments(query);
  const donations = await InKindDonation.find(query)
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  let partnerClaimedDonations = [];
  if (req.user && req.user.role === 'partner') {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });
    if (partnerProfile) {
      partnerClaimedDonations = (partnerProfile.claimedDonations || []).map(id => id.toString());
    }
  }

  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    let dbStatus = (donationObj.status || 'offered').toLowerCase();
    if (dbStatus === 'available') dbStatus = 'offered';
    
    const displayLabel = capitalize(dbStatus);
    const vId = donation.assignedVolunteerId;
    const isMine = !!(vId && req.user && (vId._id ? vId._id.equals(req.user._id) : vId.equals(req.user._id)));
    const isClaimedByMe = partnerClaimedDonations.includes(donation._id.toString()) || isMine;

    donationObj.status = displayLabel;
    donationObj.displayStatus = displayLabel;
    donationObj.statusLabel = displayLabel;
    donationObj.statusColor = statusColors[dbStatus] || '#A16D36';
    donationObj.isClaimed = !!(isClaimedByMe || donation.assignedVolunteerId);
    donationObj.claimedByMe = !!isClaimedByMe;
    donationObj.isApproved = ['approved', 'scheduled', 'completed', 'pickedup', 'delivered'].includes(dbStatus);
    donationObj.isRejected = dbStatus === 'rejected';

    return donationObj;
  });

  const [pendingCount, claimedCount, approvedCount] = await Promise.all([
    InKindDonation.countDocuments({ status: 'pending' }),
    InKindDonation.countDocuments({ status: 'claimed' }),
    InKindDonation.countDocuments({ status: 'approved' })
  ]);

  res.status(200).json({ 
    success: true, 
    count: transformedDonations.length, 
    stats: {
      pendingCount,
      claimedCount,
      approvedCount,
      totalCount: total
    },
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      count: transformedDonations.length
    },
    data: transformedDonations 
  });
});

/**
 * @desc    Claim a donation item
 */
const claimDonation = asyncHandler(async (req, res, next) => {
  const donation = await InKindDonation.findById(req.params.id);

  if (!donation) {
    return next(new ErrorResponse('Donation item not found.', 404));
  }

  if (donation.assignedVolunteerId) {
    return next(new ErrorResponse('This item has already been claimed.', 400));
  }

  donation.assignedVolunteerId = req.user._id;
  donation.status = 'claimed';
  donation.source = req.body.source || 'app';

  if (req.user.role === 'partner') {
    donation.recipientId = req.user._id;
    await PartnerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $addToSet: { claimedDonations: donation._id } },
      { new: true, upsert: true }
    );
  }

  await donation.save();

  res.status(200).json({ success: true, message: 'Item claimed!', data: donation });
});

/**
 * @desc    Get assigned donations
 */
const getAssignedDonations = asyncHandler(async (req, res, next) => {
  const partnerId = req.user._id;
  const { status, search } = req.query;
  
  let partnerClaimedDonations = [];
  const partnerProfile = await PartnerProfile.findOne({ userId: partnerId });
  if (partnerProfile) {
    partnerClaimedDonations = (partnerProfile.claimedDonations || []).map(id => id.toString());
  }

  let query = { 
    $or: [
      { recipientId: partnerId },
      { _id: { $in: partnerClaimedDonations } }
    ]
  };

  if (status && status !== 'all') {
    query.status = status.toLowerCase();
  }

  if (search) {
    query.itemName = { $regex: search, $options: 'i' };
  }

  const donations = await InKindDonation.find(query).populate('donorId', 'firstName lastName email').sort({ createdAt: -1 });

  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    let dbStatus = (donationObj.status || 'offered').toLowerCase();
    const displayLabel = capitalize(dbStatus);
    const vId = donation.assignedVolunteerId;
    const isMine = !!(vId && (vId._id ? vId._id.equals(partnerId) : vId.equals(partnerId)));
    const isClaimedByMe = !!(partnerClaimedDonations.includes(donation._id.toString()) || isMine);

    donationObj.status = displayLabel;
    donationObj.displayStatus = displayLabel;
    donationObj.statusLabel = displayLabel;
    donationObj.statusColor = statusColors[dbStatus] || '#A16D36';
    donationObj.isClaimed = !!(isClaimedByMe || donation.assignedVolunteerId);
    donationObj.claimedByMe = isClaimedByMe;
    donationObj.isApproved = ['approved', 'scheduled', 'completed', 'pickedup', 'delivered'].includes(dbStatus);
    donationObj.isRejected = dbStatus === 'rejected';

    return donationObj;
  });

  res.status(200).json({ success: true, data: transformedDonations });
});

/**
 * @desc    Get donor dashboard stats
 */
const getDonorDashboard = asyncHandler(async (req, res, next) => {
  const donorId = req.user._id;
  const donations = await InKindDonation.find({ donorId });
  const donorProfile = await DonorProfile.findOne({ userId: donorId });

  res.status(200).json({
    success: true,
    data: {
      totalDonations: donations.length,
      pendingDonations: donations.filter(d => d.status === 'pending').length,
      approvedDonations: donations.filter(d => ['approved', 'scheduled', 'completed'].includes(d.status)).length,
      impactProgress: 0
    }
  });
});

/**
 * @desc    Update donor profile
 */
const updateDonorProfile = asyncHandler(async (req, res, next) => {
  const { monthlyGoal } = req.body;
  const profile = await DonorProfile.findOneAndUpdate({ userId: req.user._id }, { monthlyGoal }, { new: true, upsert: true });
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Update a pending in-kind donation
 */
const updateDonation = asyncHandler(async (req, res, next) => {
  const donation = await InKindDonation.findOne({ _id: req.params.id, donorId: req.user._id });
  if (!donation) return next(new ErrorResponse('Donation not found', 404));
  
  Object.assign(donation, req.body);
  if (req.file) donation.image = req.file.path;
  await donation.save();
  
  res.status(200).json({ success: true, data: donation });
});

/**
 * @desc    Get all in-kind donations (public/partner feed)
 */
const getAllDonations = asyncHandler(async (req, res, next) => {
  const { search, category, status } = req.query;

  let partnerClaimedDonations = [];
  if (req.user && req.user.role === 'partner') {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });
    if (partnerProfile) {
      partnerClaimedDonations = (partnerProfile.claimedDonations || []).map(id => id.toString());
    }
  }

  let query = {};
  if (search) {
    query.$or = [{ itemName: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  }
  if (category) {
    query.itemCategory = category;
  }

  if (status && status !== 'all') {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'claimed' && req.user?.role === 'partner') {
      query._id = { $in: partnerClaimedDonations };
    } else {
      query.status = normalizedStatus;
    }
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await InKindDonation.countDocuments(query);
  const donations = await InKindDonation.find(query)
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    let dbStatus = (donationObj.status || 'offered').toLowerCase();
    if (dbStatus === 'available') dbStatus = 'offered';
    
    const displayLabel = capitalize(dbStatus);
    const vId = donation.assignedVolunteerId;
    const isMine = !!(vId && req.user && (vId._id ? vId._id.equals(req.user._id) : vId.equals(req.user._id)));
    const isClaimedByMe = partnerClaimedDonations.includes(donation._id.toString()) || isMine;

    donationObj.status = displayLabel;
    donationObj.displayStatus = displayLabel;
    donationObj.statusLabel = displayLabel;
    donationObj.statusColor = statusColors[dbStatus] || '#A16D36';
    donationObj.isClaimed = !!(isClaimedByMe || donation.assignedVolunteerId);
    donationObj.claimedByMe = !!isClaimedByMe;
    donationObj.isApproved = ['approved', 'scheduled', 'completed', 'pickedup', 'delivered'].includes(dbStatus);
    donationObj.isRejected = dbStatus === 'rejected';

    return donationObj;
  });

  // Aggregated Stats for the feed
  const [pendingCount, claimedCount, approvedCount] = await Promise.all([
    InKindDonation.countDocuments({ status: 'pending' }),
    InKindDonation.countDocuments({ status: 'claimed' }),
    InKindDonation.countDocuments({ status: 'approved' })
  ]);

  res.status(200).json({ 
    success: true, 
    count: transformedDonations.length, 
    stats: {
      pendingCount,
      claimedCount,
      approvedCount,
      totalCount: total
    },
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      count: transformedDonations.length
    },
    data: transformedDonations 
  });
});

/**
 * @desc    Update status of a donation
 */
const ChangeDonationStatus = asyncHandler(async (req, res, next) => {
  const { donationId } = req.params;
  let { status } = req.body;
  
  if (status && typeof status === 'string') {
    status = status.replace(/^["'](.+)["']$/, '$1').trim().toLowerCase();
  }
  
  const donation = await InKindDonation.findById(donationId);
  if (!donation) return next(new ErrorResponse('Donation not found', 404));

  if (['claimed', 'pickedup', 'delivered'].includes(status) && req.user) {
    donation.recipientId = req.user._id;
    if (status === 'claimed' && req.user.role === 'partner') {
      await PartnerProfile.findOneAndUpdate(
        { userId: req.user._id },
        { $addToSet: { claimedDonations: donationId } },
        { new: true, upsert: true }
      );
    }
  }

  donation.status = status;
  if (req.file) donation.image = req.file.path;
  await donation.save();

  try {
    await sendNotification(
      donation.donorId,
      'Donation Update',
      `The status of your donation "${donation.itemName}" has been updated to ${capitalize(status)}.`,
      'update',
      'info'
    );
  } catch (err) {
    console.error('Notification Error:', err.message);
  }

  res.status(200).json({ success: true, message: 'Status updated', data: donation });
});

/**
 * @desc    Get specific donation by ID
 */
const getInKindDonationById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const donation = await InKindDonation.findById(id)
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email phone')
    .populate('recipientId', 'firstName lastName email');

  if (!donation) return next(new ErrorResponse('Donation not found', 404));

  const donationObj = donation.toObject();
  let dbStatus = (donationObj.status || 'offered').toLowerCase();
  const displayLabel = capitalize(dbStatus);
  
  let isClaimedByMe = false;
  if (req.user && req.user.role === 'partner') {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });
    if (partnerProfile) isClaimedByMe = (partnerProfile.claimedDonations || []).some(cid => cid.toString() === id);
  }
  const vId = donation.assignedVolunteerId;
  if (!isClaimedByMe && vId && req.user && (vId._id ? vId._id.equals(req.user._id) : vId.equals(req.user._id))) {
    isClaimedByMe = true;
  }

  donationObj.status = displayLabel;
  donationObj.displayStatus = displayLabel;
  donationObj.statusLabel = displayLabel;
  donationObj.statusColor = statusColors[dbStatus] || '#A16D36';
  donationObj.isClaimed = !!(isClaimedByMe || donation.assignedVolunteerId);
  donationObj.claimedByMe = !!isClaimedByMe;
  donationObj.isApproved = ['approved', 'scheduled', 'completed', 'pickedup', 'delivered'].includes(dbStatus);
  donationObj.isRejected = dbStatus === 'rejected';
  
  res.status(200).json({ success: true, data: donationObj });
});

/**
 * @desc    Zeffy Webhook Handler (via Zapier)
 */
const zeffyWebhook = asyncHandler(async (req, res) => {
  let payload = req.body;
  if (Array.isArray(payload) && payload.length > 0) payload = payload[0];
  if (payload && payload.data && !payload.donor_email) payload = Array.isArray(payload.data) ? payload.data[0] : payload.data;

  const { donation_id, donor_email, donor_name, amount, currency, transaction_date, campaign_name, payment_status, is_anonymous, organization_name, recurring } = payload;

  if (!donor_email || !amount || !payment_status) return res.status(400).json({ success: false, message: 'Missing fields' });

  if (payment_status !== 'completed' && payment_status !== 'succeeded') return res.status(200).json({ success: true, message: 'Skipped' });

  let donor = await User.findOne({ email: donor_email });
  if (!donor) {
    const nameParts = (donor_name || 'Anonymous Donor').trim().split(' ');
    donor = await User.create({ firstName: nameParts[0] || 'Anonymous', lastName: nameParts.slice(1).join(' ') || '', email: donor_email, password: Math.random().toString(36).slice(-10), role: 'sponsor', isApproved: true });
    await Sponsor.create({ userId: donor._id, organizationName: organization_name || nameParts[0], isAnonymous: is_anonymous || false });
  }

  const donation = await MonetaryDonation.create({ sponsorId: donor._id, amount, currency: currency || 'USD', mealsProvided: Math.floor(amount / 2.5), paymentMethod: 'Zeffy', projectTitle: campaign_name || 'General Donation', isAnonymous: is_anonymous || false, isMonthly: recurring || false, transactionId: donation_id, status: 'completed' });

  await Sponsor.findOneAndUpdate({ userId: donor._id }, { $inc: { totalContributed: amount } });

  try {
    await sendNotification(donor._id, 'Payment Received', `Your donation of ${amount} ${currency || 'USD'} has been processed.`, 'approval', 'checkmark');
  } catch (err) {
    console.error('Notification Error:', err.message);
  }

  res.status(200).json({ success: true, message: 'Processed' });
});

/**
 * @desc    Submit a monetary donation pledge
 */
const submitMonetaryDonation = asyncHandler(async (req, res, next) => {
  const { amount, eventId } = req.body;
  const donation = await MonetaryDonation.create({ sponsorId: req.user._id, eventId, amount, status: 'pending', paymentMethod: 'Zeffy' });
  try {
    await sendNotification(req.user._id, 'Donation Pledge Recorded', `Your pledge has been recorded.`, 'update', 'info');
  } catch (err) {
    console.error('Notification Error:', err.message);
  }
  res.status(201).json({ success: true, data: donation });
});

/**
 * @desc    Get my monetary donations
 */
const getMyMonetaryDonations = asyncHandler(async (req, res, next) => {
  const donations = await MonetaryDonation.find({ sponsorId: req.user._id }).populate('eventId', 'title').sort({ createdAt: -1 });
  const totalAmount = donations.reduce((acc, d) => acc + (d.amount || 0), 0);
  const formatted = donations.map(d => ({ name: d.projectTitle, date: d.date || d.createdAt, amount: d.amount, status: d.status }));
  res.status(200).json({ success: true, totalDonationAmount: totalAmount, data: formatted });
});

module.exports = { offerItem, getMyDonations, getAvailablePickups, claimDonation, getAssignedDonations, getDonorDashboard, updateDonorProfile, updateDonation, getAllDonations, getInKindDonationById, ChangeDonationStatus, zeffyWebhook, submitMonetaryDonation, getMyMonetaryDonations };
