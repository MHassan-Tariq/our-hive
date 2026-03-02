const mongoose = require('mongoose');
const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const ActivityLog = require('../models/ActivityLog');
const Opportunity = require('../models/Opportunity');
const Campaign = require('../models/Campaign');
const MonetaryDonation = require('../models/MonetaryDonation');
const SystemSettings = require('../models/SystemSettings');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');

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
const getAllUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, role } = req.query;

  const query = {};
  if (role) {
    query.role = role;
  }
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: users.length,
    pagination: {
      totalPages: Math.ceil(total / limit),
      totalResults: total
    },
    data: users,
  });
});
/**
 * @desc    Get admin dashboard — stats, activity feed, campaign goal, search
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin only)
 */
const getDashboard = asyncHandler(async (req, res, next) => {
  const { search } = req.query;

  // ── 1. Stat Cards ─────────────────────────────────────────
  const roleCountsArr = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
  const roleCounts = ROLES.reduce((acc, role) => { acc[role] = 0; return acc; }, {});
  roleCountsArr.forEach(({ _id, count }) => { roleCounts[_id] = count; });

  // Pending Approvals: partners awaiting approval
  const pendingApprovalsCount = await User.countDocuments({ role: 'partner', isApproved: false });
  // Pending Donations: in-kind donors without confirmed pickup
  const pendingDonationsCount = await User.countDocuments({ role: 'donor', isApproved: false });
  // Active Campaigns
  const activeCampaignsCount = await Campaign.countDocuments({ isActive: true });

  // ── 2. Recent Activity Feed ────────────────────────────────
  const recentActivity = await ActivityLog.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('userId', 'firstName lastName role');

  const formattedActivity = recentActivity.map(log => ({
    _id: log._id,
    type: log.type,
    content: log.content,
    user: log.userId
      ? { _id: log.userId._id, name: `${log.userId.firstName} ${log.userId.lastName}`, role: log.userId.role }
      : null,
    relatedId: log.relatedId,
    relatedModel: log.relatedModel,
    createdAt: log.createdAt,
  }));

  // ── 3. Active Campaign Goal Widget ────────────────────────
  const activeCampaign = await Campaign.findOne({ isActive: true, goalAmount: { $gt: 0 } })
    .sort({ createdAt: -1 })
    .select('title goalAmount raisedAmount goalDeadline imageUrl');

  let campaignGoal = null;
  if (activeCampaign) {
    const pct = activeCampaign.goalAmount > 0
      ? Math.round((activeCampaign.raisedAmount / activeCampaign.goalAmount) * 100)
      : 0;
    const daysLeft = activeCampaign.goalDeadline
      ? Math.max(0, Math.ceil((new Date(activeCampaign.goalDeadline) - Date.now()) / 86400000))
      : null;
    campaignGoal = {
      _id: activeCampaign._id,
      title: activeCampaign.title,
      goalAmount: activeCampaign.goalAmount,
      raisedAmount: activeCampaign.raisedAmount,
      percentageReached: pct,
      daysRemaining: daysLeft,
      imageUrl: activeCampaign.imageUrl,
    };
  }

  // ── 4. Campaign Search ────────────────────────────────────
  let campaigns = null;
  if (search) {
    campaigns = await Campaign.find({
      title: { $regex: search, $options: 'i' },
    }).select('title isActive goalAmount raisedAmount');
  }

  // ── 5. Response ───────────────────────────────────────────
  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalParticipants: roleCounts.participant,
        totalVolunteers: roleCounts.volunteer,
        totalPartners: roleCounts.partner,
        pendingApprovals: pendingApprovalsCount,
        pendingDonations: pendingDonationsCount,
        activeCampaigns: activeCampaignsCount,
      },
      recentActivity: formattedActivity,
      campaignGoal,
      ...(campaigns !== null && { searchResults: campaigns }),
    },
  });
});

/**
 * @desc    Update a partner's approval status
 * @route   PATCH /api/admin/partners/:id/status
 * @access  Private (Admin only)
 * :id — the PartnerProfile document _id
 */
const updatePartnerStatus = asyncHandler(async (req, res, next) => {
  
  let { status } = req.body;
  const validStatuses = ['Active', 'Pending', 'Expired', 'Suspended', 'Rejected'];
console.log(status);  
  // Normalize status from frontend (e.g., 'active' -> 'Active')
  if (status) {
    status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const profile = await PartnerProfile.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Partner profile not found', 404));
  }

  // Keep User.isApproved in sync for the dashboard query
  // approved/Active means approved
  await User.findByIdAndUpdate(profile.userId, {
    isApproved: status === 'Active',
  });

  // Activity Log
  if (status === 'Active') {
    const ActivityLog = require('../models/ActivityLog'); // Ensure model is available
    await ActivityLog.create({
      userId: profile.userId,
      type: 'Submission Approved',
      content: `Your organization "${profile.orgName}" has been approved. You can now list events on the Hive calendar.`,
      relatedId: profile._id,
      relatedModel: 'PartnerProfile',
    });
  }

  res.status(200).json({
    success: true,
    message: `Partner status updated to '${status}'.`,
    data: profile,
  });
});

/**
 * @desc    Update an opportunity/event approval status
 * @route   PATCH /api/admin/opportunities/:id/status
 * @access  Private (Admin only)
 */
const updateOpportunityStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['Draft', 'Confirmed', 'Pending', 'Completed', 'Cancelled', 'Rejected'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const opportunity = await Opportunity.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!opportunity) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }

  // Activity Log
  await ActivityLog.create({
    userId: opportunity.partnerId,
    type: status === 'Confirmed' ? 'Submission Approved' : 'Profile Updated',
    content: status === 'Confirmed' 
      ? `Your event "${opportunity.title}" has been approved.` 
      : `Your event "${opportunity.title}" status changed to ${status}.`,
    relatedId: opportunity._id,
    relatedModel: 'Opportunity',
  });

  res.status(200).json({
    success: true,
    message: `Opportunity status updated to '${status}'.`,
    data: opportunity,
  });
});

/**
 * @desc    Add hours to a volunteer's totalHours
 * @route   PATCH /api/admin/volunteer/add-hours/:id
 * @access  Private (Admin only)
 * :id — the VolunteerProfile document _id
 */
const addVolunteerHours = asyncHandler(async (req, res, next) => {
  const { hours } = req.body;

  if (!hours || typeof hours !== 'number' || hours <= 0) {
    return next(new ErrorResponse('Please provide a positive number for hours', 400));
  }

  const profile = await VolunteerProfile.findByIdAndUpdate(
    req.params.id,
    { $inc: { totalHours: hours } }, // atomic increment
    { new: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  res.status(200).json({
    success: true,
    message: `Added ${hours} hours. Total hours: ${profile.totalHours}.`,
    data: profile,
  });
});

/**
 * @desc    Get financial overview — total raised from all sponsors
 * @route   GET /api/admin/finances
 * @access  Private (Admin only)
 */
const getFinances = asyncHandler(async (req, res, next) => {
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
    .populate('userId', 'firstName lastName email');

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
});

/**
 * @desc    Get summary of all participants (masked names for privacy)
 * @route   GET /api/admin/participants/summary
 * @access  Private (Admin only)
 */
const getParticipantSummary = asyncHandler(async (req, res, next) => {
  const users = await User.find({ role: 'participant' }).select('firstName lastName email role createdAt');
  
  // Mask names: "John Doe" -> "John D."
  const maskedUsers = users.map(user => {
    const maskedName = user.lastName 
      ? `${user.firstName} ${user.lastName[0]}.` 
      : user.firstName;
      
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
});

const ParticipantProfile = require('../models/ParticipantProfile');

/**
 * @desc    List participants with pagination, search, and status filter (Admin)
 * @route   GET /api/admin/participants
 * @access  Private (Admin only)
 */
const adminListParticipants = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status, housingStatus } = req.query;

  // Build user filter
  const userQuery = { role: 'participant' };
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    userQuery.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }
  const matchingUsers = await User.find(userQuery).select('_id firstName lastName email');
  const userIds = matchingUsers.map(u => u._id);

  // Build profile filter
  const profileQuery = { userId: { $in: userIds } };
  if (status) profileQuery.accountStatus = status;
  if (housingStatus) profileQuery.housingStatus = housingStatus;

  const total = await ParticipantProfile.countDocuments(profileQuery);
  const profiles = await ParticipantProfile.find(profileQuery)
    .populate('userId', 'firstName lastName email createdAt')
    .select('participantId housingStatus address accountStatus intakeStatus gender')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: profiles.length,
    data: profiles,
  });
});

/**
 * @desc    Get full participant detail for admin view
 * @route   GET /api/admin/participants/:id
 * @access  Private (Admin only)
 */
const adminGetParticipant = asyncHandler(async (req, res, next) => {
  const profile = await ParticipantProfile.findById(req.params.id)
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt isApproved');
  if (!profile) return next(new ErrorResponse('Participant not found', 404));
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Update participant profile fields (Admin Edit)
 * @route   PATCH /api/admin/participants/:id
 * @access  Private (Admin only)
 */
const adminUpdateParticipant = asyncHandler(async (req, res, next) => {
  const allowed = [
    'housingStatus', 'address', 'unhousedDetails', 'householdSize',
    'childrenCount', 'seniorsCount', 'petsCount', 'dietaryRestrictions',
    'isVeteran', 'hasDisability', 'gender', 'raceEthnicity', 'primaryLanguage',
    'monthlyIncome', 'citizenStatus', 'assistancePrograms', 'accountStatus', 'interests'
  ];
  const updates = {};
  allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

  const profile = await ParticipantProfile.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!profile) return next(new ErrorResponse('Participant not found', 404));
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Deactivate a participant account
 * @route   PATCH /api/admin/participants/:id/deactivate
 * @access  Private (Admin only)
 */
const adminDeactivateParticipant = asyncHandler(async (req, res, next) => {
  const profile = await ParticipantProfile.findByIdAndUpdate(
    req.params.id,
    { accountStatus: 'INACTIVE' },
    { new: true }
  );
  if (!profile) return next(new ErrorResponse('Participant not found', 404));
  res.status(200).json({ success: true, message: 'Participant deactivated.', data: profile });
});

/**
 * @desc    Export all participant records as a CSV file
 * @route   GET /api/admin/participants/export
 * @access  Private (Admin only)
 */
const adminExportParticipantsCSV = asyncHandler(async (req, res, next) => {
  const profiles = await ParticipantProfile.find()
    .populate('userId', 'firstName lastName email phone createdAt');

  const rows = [
    ['Participant ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Housing Status',
     'City', 'Account Status', 'Intake %', 'Gender', 'Monthly Income', 'Registered At'].join(',')
  ];

  profiles.forEach(p => {
    const u = p.userId || {};
    rows.push([
      p.participantId || '',
      u.firstName || '', u.lastName || '', u.email || '', u.phone || '',
      p.housingStatus || '',
      p.address?.city || '',
      p.accountStatus || '',
      p.intakeStatus?.percentage || 0,
      p.gender || '',
      p.monthlyIncome || 0,
      u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
  res.status(200).send(rows.join('\n'));
});

const InKindDonation = require('../models/InKindDonation');

/**
 * @desc    List all in-kind donations with stats and pagination
 * @route   GET /api/admin/in-kind-donations
 * @access  Private (Admin only)
 */
const adminListInKindDonations = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Calculate Dashboard Stats
  // 1. Pending Review Count
  const pendingReviewCount = await InKindDonation.countDocuments({ status: 'pending' });

  // 2. Approved This Week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const approvedThisWeekCount = await InKindDonation.countDocuments({
    status: 'approved',
    updatedAt: { $gte: startOfWeek }
  });

  // 3. Scheduled Pickups Today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const scheduledPickupsTodayCount = await InKindDonation.countDocuments({
    status: 'scheduled',
    pickupDate: { $gte: startOfDay, $lte: endOfDay }
  });

// Fetch Paginated List
  const { search } = req.query;
  const listQuery = {};
  
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    
    // Find users matching search to extract their IDs
    const matchingUsers = await User.find({
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }]
    }).select('_id');
    
    const userIds = matchingUsers.map(u => u._id);
    
    // Search either in specific document fields or related donor IDs
    listQuery.$or = [
      { itemName: regex },
      { donorName: regex },
      { donorId: { $in: userIds } }
    ];
  }

  const total = await InKindDonation.countDocuments(listQuery);
  const donations = await InKindDonation.find(listQuery)
    .populate('donorId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    stats: {
      pendingReviewCount,
      approvedThisWeekCount,
      scheduledPickupsTodayCount
    },
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      count: donations.length
    },
    data: donations
  });
});

/**
 * @desc    Update an In-Kind Donation status
 * @route   PATCH /api/admin/in-kind-donations/:id/status
 * @access  Private (Admin only)
 */
const adminUpdateInKindDonationStatus = asyncHandler(async (req, res, next) => {
  const { status, rejectionReason, locationName, storageRoom, storageRack, storageShelf, storageFloor } = req.body;

  if (!['pending', 'approved', 'scheduled', 'completed', 'rejected'].includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  const updates = { status };
  if (status === 'rejected' && rejectionReason) updates.rejectionReason = rejectionReason;
  
  if (locationName) updates.locationName = locationName;
  if (storageRoom !== undefined || storageRack !== undefined || storageShelf !== undefined || storageFloor !== undefined) {
    updates['storageDetails.room'] = storageRoom;
    updates['storageDetails.rack'] = storageRack;
    updates['storageDetails.shelf'] = storageShelf;
    updates['storageDetails.floor'] = storageFloor;
  }

  const donation = await InKindDonation.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  // Activity Log integration
  await ActivityLog.create({
    userId: donation.donorId,
    type: 'Profile Updated', // Using closest existing enum until ActivityLog is updated for specific donation changes
    content: `Your in-kind donation of "${donation.itemName}" is now ${status}.`,
    relatedId: donation._id,
    relatedModel: 'InKindDonation',
  });

  res.status(200).json({ success: true, data: donation });
});

/**
 * @desc    Export in-kind donations to CSV
 * @route   GET /api/admin/in-kind-donations/export
 * @access  Private (Admin only)
 */
const adminExportInKindDonationsCSV = asyncHandler(async (req, res, next) => {
  const donations = await InKindDonation.find().populate('donorId', 'firstName lastName');

  const headers = [
    'Ref ID', 'Donor Name', 'Item Name', 'Category', 'Quantity', 
    'Delivery Method', 'Destination', 'Storage Room', 'Status', 'Date Submitted'
  ];

  const rows = [headers.join(',')];

  donations.forEach(d => {
    const donorName = d.donorId ? `${d.donorId.firstName} ${d.donorId.lastName}` : 'Unknown';
    const dest = d.locationName || '';
    const storage = d.storageDetails?.room ? `${d.storageDetails.room} ${d.storageDetails.rack || ''} ${d.storageDetails.shelf || ''}`.trim() : '';
    const row = [
      d.refId,
      donorName,
      d.itemName,
      d.itemCategory,
      d.quantity || '',
      d.deliveryMethod || '',
      dest,
      storage,
      d.status,
      d.createdAt.toISOString().split('T')[0]
    ].map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',');
    rows.push(row);
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="in_kind_donations.csv"');
  res.status(200).send(rows.join('\n'));
});

/**
 * @desc    Get a single in-kind donation by ID
 * @route   GET /api/admin/in-kind-donations/:id
 * @access  Private (Admin only)
 */
const adminGetInKindDonation = asyncHandler(async (req, res, next) => {
  const donation = await InKindDonation.findById(req.params.id)
    .populate('donorId', 'firstName lastName email phone profilePictureUrl');
  
  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  res.status(200).json({ success: true, data: donation });
});

/**
 * @desc    List all volunteers with pagination, search, and screening status (Admin)
 * @route   GET /api/admin/volunteers
 * @access  Private (Admin only)
 */
const adminListVolunteers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status } = req.query;

  // 1. Build User Query
  const userQuery = { role: 'volunteer' };
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    userQuery.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }
  const matchingUsers = await User.find(userQuery).select('_id');
  const userIds = matchingUsers.map(u => u._id);

  // 2. Build Profile Query
  const profileQuery = { userId: { $in: userIds } };
  if (status) profileQuery.backgroundCheckStatus = status;

  // 3. Fetch Data
  const total = await VolunteerProfile.countDocuments(profileQuery);
  const profiles = await VolunteerProfile.find(profileQuery)
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt isApproved')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: profiles.length,
    pagination: {
      totalPages: Math.ceil(total / limit),
      totalResults: total
    },
    data: profiles,
  });
});

/**
 * @desc    Get single volunteer detail (Admin)
 * @route   GET /api/admin/volunteers/:id
 * @access  Private (Admin only)
 */
const adminGetVolunteer = asyncHandler(async (req, res, next) => {
  const profile = await VolunteerProfile.findById(req.params.id)
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt isApproved');

  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  res.status(200).json({
    success: true,
    data: profile
  });
});

/**
 * @desc    Update volunteer profile (Admin)
 * @route   PATCH /api/admin/volunteers/:id
 * @access  Private (Admin only)
 * :id — the VolunteerProfile document _id
 */
const adminUpdateVolunteerProfile = asyncHandler(async (req, res, next) => {
  const profile = await VolunteerProfile.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Update sponsor profile (Admin)
 * @route   PATCH /api/admin/sponsors/:id
 * @access  Private (Admin only)
 * :id — the Sponsor document _id
 */
const adminUpdateSponsorProfile = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse('Invalid Sponsor ID', 400));
  }

  // Find by Sponsor _id
  let sponsor = await Sponsor.findById(id);

  if (!sponsor) {
    return next(new ErrorResponse('Sponsor not found', 404));
  }

  // Update Sponsor document
  sponsor = await Sponsor.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  // If patching isApproved, we must update the root User document directly
  if (req.body.status !== undefined) {
    await User.findByIdAndUpdate(sponsor.userId, { 
      isApproved: req.body.status === 'Active' 
    });
  }

  res.status(200).json({ success: true, data: sponsor });
});

/**
 * @desc    Delete a sponsor (Admin)
 * @route   DELETE /api/admin/sponsors/:id
 * @access  Private (Admin only)
 */
const adminDeleteSponsor = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse('Invalid Sponsor ID', 400));
  }

  const sponsor = await Sponsor.findByIdAndDelete(id);

  if (!sponsor) {
    return next(new ErrorResponse('Sponsor not found', 404));
  }

  // Optionally delete/deactivate the User account too? 
  // For now, just removing the Sponsor profile as requested.
  // If we wanted to remove the user:
  // await User.findByIdAndDelete(sponsor.userId);

  res.status(200).json({
    success: true,
    message: 'Sponsor deleted successfully'
  });
});

/**
 * @desc    List all partners with pagination and search
 * @route   GET /api/admin/community-partners
 * @access  Private (Admin only)
 */
const adminListPartners = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status } = req.query;

  const query = {};
  if (status) query.status = status;
  
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    
    // Find users matching search to extract their IDs
    const matchingUsers = await User.find({
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }]
    }).select('_id');
    
    const userIds = matchingUsers.map(u => u._id);
    
    query.$or = [
      { orgName: regex },
      { userId: { $in: userIds } },
      { partnerId: regex }
    ];
  }

  const total = await PartnerProfile.countDocuments(query);
  const partners = await PartnerProfile.find(query)
    .populate('userId', 'firstName lastName email profilePictureUrl phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: partners.length,
    data: partners
  });
});

/**
 * @desc    List all opportunities (events) with pagination and search
 * @route   GET /api/admin/opportunities
 * @access  Private (Admin only)
 */
const adminListOpportunities = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status } = req.query;

  const query = {};
  if (status) query.status = status;

  if (search) {
    const regex = { $regex: search, $options: 'i' };
    query.$or = [
      { title: regex },
      { location: regex },
      { category: regex }
    ];
  }

  const total = await Opportunity.countDocuments(query);
  const opportunities = await Opportunity.find(query)
    .populate('partnerId', 'firstName lastName email profilePictureUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: opportunities.length,
    data: opportunities
  });
});

/**
 * @desc    Get a single partner detail
 * @route   GET /api/admin/community-partners/:id
 * @access  Private (Admin only)
 */
const adminGetPartner = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new ErrorResponse('Partner profile not found', 404));
  }
  const partner = await PartnerProfile.findById(req.params.id).populate('userId', 'firstName lastName email profilePictureUrl phone');
  if (!partner) {
    return next(new ErrorResponse('Partner profile not found', 404));
  }
  res.status(200).json({ success: true, data: partner });
});

/**
 * @desc    Update a partner profile
 * @route   PATCH /api/admin/community-partners/:id
 * @access  Private (Admin only)
 * :id — the PartnerProfile document _id
 */
const adminUpdatePartnerProfile = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse('Invalid Partner ID', 400));
  }

  const updates = { ...req.body };
  
  if (req.file) {
    updates.organizationLogoUrl = req.file.path;
  }

  const partner = await PartnerProfile.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!partner) {
    return next(new ErrorResponse('Partner profile not found', 404));
  }

  res.status(200).json({ success: true, data: partner });
});

/**
 * @desc    Delete a partner
 * @route   DELETE /api/admin/community-partners/:id
 * @access  Private (Admin only)
 */
const adminDeletePartner = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse('Invalid Partner ID', 400));
  }

  const partner = await PartnerProfile.findByIdAndDelete(id);

  if (!partner) {
    return next(new ErrorResponse('Partner profile not found', 404));
  }

  // Also remove the base user account
  await User.findByIdAndDelete(partner.userId);

  res.status(200).json({
    success: true,
    message: 'Partner deleted successfully'
  });
});

/**
 * @desc    Get a single opportunity (event) detail
 * @route   GET /api/admin/events/:id
 * @access  Private (Admin only)
 */
const adminGetOpportunity = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }
  const opportunity = await Opportunity.findById(req.params.id).populate('partnerId', 'firstName lastName email');
  if (!opportunity) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }
  res.status(200).json({ success: true, data: opportunity });
});

const adminCreateOpportunity = asyncHandler(async (req, res, next) => {
  // Logic for admin creating an event
  const opportunityData = {
    ...req.body,
    partnerId: req.body.partnerId || req.user.id,
    status: req.body.status || 'Active'
  };

  // Safeguards for numeric fields from FormData
  if (opportunityData.requiredVolunteers === '' || opportunityData.requiredVolunteers === null) {
      delete opportunityData.requiredVolunteers;
  } else if (typeof opportunityData.requiredVolunteers === 'string') {
      opportunityData.requiredVolunteers = parseInt(opportunityData.requiredVolunteers, 10);
  }

  // Ensure partnerId is a valid ObjectId string
  if (typeof opportunityData.partnerId === 'object') {
      opportunityData.partnerId = opportunityData.partnerId._id || req.user.id;
  }

  if (req.file) {
    opportunityData.imageurl = req.file.path || req.file.secure_url || req.file.url;
  }

  const opportunity = await Opportunity.create(opportunityData);

  res.status(201).json({
    success: true,
    data: opportunity
  });
});

/**
 * @desc    Update an opportunity (event)
 * @route   PATCH /api/admin/events/:id
 * @access  Private (Admin only)
 */
const adminUpdateOpportunity = asyncHandler(async (req, res, next) => {
  console.log('DEBUG: adminUpdateOpportunity body:', JSON.stringify(req.body));
  console.log('DEBUG: adminUpdateOpportunity file:', req.file);
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }
  
  const updates = { ...req.body };
  
  // Remove fields that should not be updated directly
  delete updates._id;
  delete updates.__v;
  delete updates.createdAt;
  delete updates.updatedAt;
  
  // Safeguards for numeric fields from FormData
  if (updates.requiredVolunteers === '' || updates.requiredVolunteers === null) {
    delete updates.requiredVolunteers;
  } else if (typeof updates.requiredVolunteers === 'string') {
    updates.requiredVolunteers = parseInt(updates.requiredVolunteers, 10);
  }

  // Handle partnerId if it's an object or invalid string
  if (typeof updates.partnerId === 'object') {
    updates.partnerId = updates.partnerId._id;
  } else if (updates.partnerId === '[object Object]') {
    delete updates.partnerId;
  }

  // Handle coordinates if they come as strings
  if (updates.coordinates && typeof updates.coordinates === 'string') {
    try {
      updates.coordinates = JSON.parse(updates.coordinates);
    } catch (e) {
      delete updates.coordinates;
    }
  }

  if (req.file) {
    updates.imageurl = req.file.path || req.file.secure_url || req.file.url;
  }
  
  const opportunity = await Opportunity.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  if (!opportunity) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }

  res.status(200).json({
    success: true,
    data: opportunity
  });
});

/**
 * @desc    Approve or Disapprove a volunteer
 * @route   PATCH /api/admin/volunteers/:id/approve
 * @access  Private (Admin only)
 */
const adminApproveVolunteer = asyncHandler(async (req, res, next) => {
  const { isApproved } = req.body;
  
  const profile = await VolunteerProfile.findById(req.params.id);
  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  // Update User model
  await User.findByIdAndUpdate(profile.userId, { isApproved });

  // Update Profile background check status if approving
  if (isApproved) {
    profile.backgroundCheckStatus = 'Verified';
    await profile.save();
  } else {
    profile.backgroundCheckStatus = 'Pending';
    await profile.save();
  }

  // Activity Log
  await ActivityLog.create({
    userId: profile.userId,
    type: 'Submission Approved',
    content: isApproved ? 'Your volunteer account has been approved.' : 'Your volunteer account approval has been revoked.',
    relatedId: profile._id,
    relatedModel: 'VolunteerProfile',
  });

  res.status(200).json({
    success: true,
    message: `Volunteer ${isApproved ? 'approved' : 'disapproved'} successfully.`,
    data: { isApproved }
  });
});

/**
 * @desc    Delete an opportunity (event)
 * @route   DELETE /api/admin/events/:id
 * @access  Private (Admin only)
 */
const adminDeleteOpportunity = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }

  const opportunity = await Opportunity.findByIdAndDelete(req.params.id);

  if (!opportunity) {
    return next(new ErrorResponse('Opportunity not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Opportunity deleted successfully'
  });
});

/**
 * @desc    Get system settings
 * @route   GET /api/admin/settings
 * @access  Private (Admin only)
 */
const adminGetSettings = asyncHandler(async (req, res, next) => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({});
  }
  res.status(200).json({ success: true, data: settings });
});

/**
 * @desc    Update system settings
 * @route   PATCH /api/admin/settings
 * @access  Private (Admin only)
 */
const adminUpdateSettings = asyncHandler(async (req, res, next) => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create(req.body);
  } else {
    settings = await SystemSettings.findByIdAndUpdate(settings._id, req.body, {
      new: true,
      runValidators: true,
    });
  }
  res.status(200).json({ success: true, data: settings });
});

/**
 * @desc    Upload volunteer agreement
 * @route   POST /api/admin/settings/agreement
 * @access  Private (Admin only)
 */
const adminUploadAgreement = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({
      agreementUrl: req.file.path,
    });
  } else {
    settings.agreementUrl = req.file.path;
    await settings.save();
  }

  res.status(200).json({
    success: true,
    data: settings,
  });
});

/**
 * @desc    Get admin profile
 * @route   GET /api/admin/profile
 * @access  Private (Admin only)
 */
const adminGetProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update admin profile info
 * @route   PATCH /api/admin/profile
 * @access  Private (Admin only)
 */
const adminUpdateProfile = asyncHandler(async (req, res, next) => {
  console.log('DEBUG: adminUpdateProfile body:', JSON.stringify(req.body));
  console.log('DEBUG: adminUpdateProfile file:', req.file);
  const { firstName, lastName, phone } = req.body;
  
  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  
  // Only update phone if it's provided and not an empty string
  if (phone !== undefined && phone !== "") {
    updateData.phone = phone;
  } else if (phone === "") {
    // If they explicitly sent an empty string, we should probably set to undefined
    // to avoid unique index collision and regex validation failure.
    updateData.phone = undefined; 
  }

  if (req.file) {
    updateData.profilePictureUrl = req.file.path;
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  );
  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update admin password
 * @route   PATCH /api/admin/profile/password
 * @access  Private (Admin only)
 */
const adminUpdatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: 'Password updated successfully' });
});

/**
 * @desc    List all sponsors with pagination, search and stats (Admin)
 * @route   GET /api/admin/sponsors
 * @access  Private (Admin only)
 */
const adminListSponsors = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status } = req.query;

  // 1. Build Query
  const userQuery = { role: 'sponsor' };
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    userQuery.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }
  const matchingUsers = await User.find(userQuery).select('_id');
  const userIds = matchingUsers.map(u => u._id);

  const sponsorQuery = { userId: { $in: userIds } };
  if (status) sponsorQuery.status = status;
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    sponsorQuery.$or = [
      ...(sponsorQuery.$or || []),
      { organizationName: regex }
    ];
  }

  // 2. Fetch Data
  const total = await Sponsor.countDocuments(sponsorQuery);
  const sponsors = await Sponsor.find(sponsorQuery)
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // 3. Calculate Stats
  // Annual Contributions (Last 365 days)
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const annualAggregation = await MonetaryDonation.aggregate([
    { $match: { createdAt: { $gte: oneYearAgo }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const annualContributions = annualAggregation[0]?.total || 0;

  // In-Kind Valuation
  const inKindAggregation = await InKindDonation.aggregate([
    { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: [ "$estimatedValue", "0" ] } } } } }
  ]);
  // Note: $toDouble might fail if estimatedValue has non-numeric characters like '$'. 
  // For a robust implementation, we'd need cleaner data or a better aggregation.
  // Assuming seeder will provide numeric-friendly strings or numbers.
  const inKindValuation = inKindAggregation[0]?.total || 0;

  // Total Active Partners
  const totalActivePartners = await Sponsor.countDocuments({ status: 'Active' });

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: sponsors.length,
    stats: {
      annualContributions,
      inKindValuation,
      totalActivePartners
    },
    data: sponsors
  });
});

/**
 * @desc    Get single sponsor detail with donation history (Admin)
 * @route   GET /api/admin/sponsors/:id
 * @access  Private (Admin only)
 */
const adminGetSponsor = asyncHandler(async (req, res, next) => {
  const sponsor = await Sponsor.findById(req.params.id)
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt');

  if (!sponsor) {
    return next(new ErrorResponse('Sponsor not found', 404));
  }

  const donationHistory = await MonetaryDonation.find({ sponsorId: sponsor.userId })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      ...sponsor._doc,
      donationHistory
    }
  });
});

/**
 * @desc    Deactivate/Activate sponsor account
 * @route   PATCH /api/admin/sponsors/:id/deactivate
 * @access  Private (Admin only)
 */
const adminDeactivateSponsor = asyncHandler(async (req, res, next) => {
  const sponsor = await Sponsor.findById(req.params.id);

  if (!sponsor) {
    return next(new ErrorResponse('Sponsor not found', 404));
  }

  sponsor.status = sponsor.status === 'Active' ? 'Inactive' : 'Active';
  await sponsor.save();

  res.status(200).json({
    success: true,
    message: `Sponsor status changed to ${sponsor.status}`,
    data: sponsor
  });
});

module.exports = { 
  getAllUsers, 
  getDashboard, 
  updatePartnerStatus, 
  updateOpportunityStatus,
  addVolunteerHours, 
  getFinances, 
  getParticipantSummary,
  adminListParticipants,
  adminGetParticipant,
  adminUpdateParticipant,
  adminDeactivateParticipant,
  adminExportParticipantsCSV,
  adminListInKindDonations,
  adminUpdateInKindDonationStatus,
  adminExportInKindDonationsCSV,
  adminGetInKindDonation,
  adminUpdateVolunteerProfile,
  adminListVolunteers,
  adminApproveVolunteer,
  adminGetVolunteer,
  adminUpdateSponsorProfile,
  adminListPartners,
  adminUpdatePartnerProfile,
  adminListOpportunities,
  adminGetPartner,
  adminGetOpportunity,
  adminCreateOpportunity,
  adminUpdateOpportunity,
  adminDeleteOpportunity,
  adminListSponsors,
  adminGetSponsor,
  adminDeactivateSponsor,
  adminDeleteSponsor,
  adminGetSettings,
  adminUpdateSettings,
  adminGetProfile,
  adminUpdateProfile,
  adminUpdatePassword,
  adminUploadAgreement,
  adminDeletePartner,
};
