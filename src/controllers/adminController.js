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
const Badge = require('../models/Badge');
const AgreementHistory = require('../models/AgreementHistory');
const VolunteerLog = require('../models/VolunteerLog');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendNotification } = require('../utils/notificationService');
const { assignBadges } = require('../utils/volunteerUtils');

const ROLES = [
  'visitor',
  'participant',
  'volunteer',
  'donor',
  'sponsor',
  'partner',
  'moderator',
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
 * @desc    Update a user's role
 * @route   PATCH /api/admin/users/:id/role
 * @access  Private (Admin only)
 */
const updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role || !ROLES.includes(role)) {
    return next(new ErrorResponse('Please provide a valid role', 400));
  }

  console.log('DEBUG: updateUserRole params.id:', req.params.id);
  console.log('DEBUG: updateUserRole user.id:', req.user.id.toString());
  console.log('DEBUG: updateUserRole new role:', role);

  if (req.params.id === req.user.id.toString()) {
    console.log('DEBUG: Prevented self-role change');
    return next(new ErrorResponse('You cannot change your own role', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user,
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

  // Pending Approvals: partners, volunteers, and participants awaiting approval
  const pendingApprovalsCount = await User.countDocuments({ 
    role: { $in: ['partner', 'volunteer', 'participant'] }, 
    isApproved: false 
  });
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
    // OneSignal Notification
    await sendNotification(
      profile.userId,
      'Organization Approved',
      `Your organization "${profile.orgName}" has been approved!`,
      'approval',
      'checkmark'
    );
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
  const { status, rejectionReason } = req.body;
  const validStatuses = ['Draft', 'Confirmed', 'Pending', 'Completed', 'Cancelled', 'Rejected'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const updateFields = { status };
  if (status === 'Rejected' && rejectionReason) {
    updateFields.rejectionReason = rejectionReason;
  }

  const opportunity = await Opportunity.findByIdAndUpdate(
    req.params.id,
    updateFields,
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

  // OneSignal Notification
  if (status === 'Confirmed') {
    await sendNotification(
      opportunity.partnerId,
      'Event Approved',
      `Your event "${opportunity.title}" has been approved for the calendar.`,
      'approval',
      'checkmark'
    );
  }

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
  let { hours } = req.body;
  
  // Handle cases where hours might be wrapped in an object from the service layer
  if (hours && typeof hours === 'object' && hours.hours !== undefined) {
    hours = hours.hours;
  }

  if (hours === undefined || hours === null || isNaN(Number(hours)) || Number(hours) <= 0) {
    return next(new ErrorResponse('Please provide a positive number for hours', 400));
  }

  const numericHours = Number(hours);

  const profile = await VolunteerProfile.findById(req.params.id);

  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  // Create a volunteer log entry for this addition as pending
  const log = await VolunteerLog.create({
    userId: profile.userId,
    hoursLogged: numericHours,
    date: new Date(),
    startTime: '09:00 AM', // Defaults for administrative entries
    endTime: '05:00 PM',
    category: req.body.category || 'Administrative / Manual Entry',
    notes: req.body.description || 'Verified hours added by admin',
    opportunityId: req.body.opportunityId || null,
    status: 'pending' // Pending admin approval as per requirements
  });

  res.status(200).json({
    success: true,
    message: `Added ${numericHours} hours. They are currently pending approval.`,
    data: profile,
    log: log // Return the created log so the frontend has the real ID
  });
});

/**
 * @desc    Approve or reject pending volunteer hours
 * @route   PATCH /api/admin/volunteer/approve-hours/:logId
 * @access  Private (Admin only)
 */
const adminApproveVolunteerHours = asyncHandler(async (req, res, next) => {
  const { status } = req.body; // 'approved' or 'rejected'
  
  if (!['approved', 'rejected'].includes(status)) {
    return next(new ErrorResponse('Invalid status. Must be approved or rejected.', 400));
  }

  const log = await VolunteerLog.findById(req.params.logId);
  
  if (!log) {
    return next(new ErrorResponse('Volunteer log not found', 404));
  }

  if (log.status !== 'pending') {
    return next(new ErrorResponse(`These hours have already been ${log.status}.`, 400));
  }

  log.status = status;
  await log.save();

  if (status === 'approved') {
    // 2. Update the profile totals since they are now approved
    let profile = await VolunteerProfile.findOne({ userId: log.userId });
    if (!profile) {
      profile = new VolunteerProfile({ userId: log.userId });
    }

    // Round the logged hours to 2 decimal places before adding
    const roundedHours = Math.round(log.hoursLogged * 100) / 100;
    
    profile.totalHours = (profile.totalHours || 0) + roundedHours;
    profile.hoursThisYear = (profile.hoursThisYear || 0) + roundedHours;
    
    // Round the final totals to 2 decimal places (in case of existing decimals)
    profile.totalHours = Math.round(profile.totalHours * 100) / 100;
    profile.hoursThisYear = Math.round(profile.hoursThisYear * 100) / 100;
    
    // Assign badges based on updated hours
    await assignBadges(profile);
    
    await profile.save();

    // Notification
    await sendNotification(
      log.userId,
      'Hours Approved',
      `Your submission of ${log.hoursLogged} hours has been approved!`,
      'update',
      'checkmark'
    );
  } else {
    // rejected
    await sendNotification(
      log.userId,
      'Hours Update',
      `Your submission of ${log.hoursLogged} hours was not approved.`,
      'update',
      'info'
    );
  }

  res.status(200).json({ success: true, data: log });
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
    'annualIncome', 'citizenStatus', 'assistancePrograms', 'accountStatus', 'interests'
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
    { 
      accountStatus: 'INACTIVE',
      isIntakeApproved: false,
      'intakeStatus.status': 'Action Required'
    },
    { new: true }
  );
  if (!profile) return next(new ErrorResponse('Participant not found', 404));

  // Also reset the User approval flag
  await User.findByIdAndUpdate(profile.userId, { isApproved: false });

  res.status(200).json({ success: true, message: 'Participant deactivated.', data: profile });
});

/**
 * @desc    Revoke detailed intake approval
 * @route   PATCH /api/admin/participants/:id/revoke-detailed
 * @access  Private (Admin only)
 */
const adminRevokeDetailedIntake = asyncHandler(async (req, res, next) => {
  const profile = await ParticipantProfile.findByIdAndUpdate(
    req.params.id,
    { 
      accountStatus: 'PENDING',
      isIntakeApproved: false,
      'intakeStatus.status': 'Action Required'
    },
    { new: true }
  );
  if (!profile) return next(new ErrorResponse('Participant not found', 404));

  res.status(200).json({ success: true, message: 'Detailed intake approval revoked.', data: profile });
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
     'City', 'Account Status', 'Intake %', 'Gender', 'Annual Income', 'Registered At'].join(',')
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
      p.annualIncome || '0',
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
  const { status, rejectionReason, locationName, additionalNotes, storageRoom, storageRack, storageShelf, storageFloor } = req.body;

  if (status && !['pending', 'approved', 'scheduled', 'completed', 'rejected'].includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  const updates = {};
  if (status) updates.status = status;
  if (status === 'rejected' && rejectionReason) updates.rejectionReason = rejectionReason;
  
  if (locationName) updates.locationName = locationName;
  if (additionalNotes !== undefined) updates.additionalNotes = additionalNotes;
  
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

  // OneSignal Notification
  let title = 'Donation Update';
  let iconType = 'info';
  if (status === 'approved') {
    title = 'Donation Approved';
    iconType = 'checkmark';
  } else if (status === 'scheduled') {
    title = 'Pickup Scheduled';
  } else if (status === 'completed') {
    title = 'Donation Completed';
    iconType = 'checkmark';
  }

  await sendNotification(
    donation.donorId,
    title,
    `Your donation of "${donation.itemName}" is now ${status}.`,
    'update',
    iconType
  );

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
  res.status(200).json({ success: true, data: donation });
});

/**
 * @desc    List all partner pickups (In-Kind Donations where donor role is 'partner')
 * @route   GET /api/admin/partner-pickups
 * @access  Private (Admin only)
 */
const adminListPartnerPickups = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search } = req.query;

  // 1. Find all users with role 'partner'
  const partnerUsers = await User.find({ role: 'partner' }).select('_id');
  const partnerUserIds = partnerUsers.map(u => u._id);

  const query = { donorId: { $in: partnerUserIds } };

  if (search) {
    const regex = { $regex: search, $options: 'i' };

    // Find partner users matching the search to extract their IDs
    const matchingUsers = await User.find({
      role: 'partner',
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }]
    }).select('_id');
    const matchingUserIds = matchingUsers.map(u => u._id);

    query.$or = [
      { itemName: regex },
      { donorName: regex },
      { donorId: { $in: matchingUserIds } }
    ];
  }

  const total = await InKindDonation.countDocuments(query);
  const donations = await InKindDonation.find(query)
    .populate('donorId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Stats for the pickups page
  const pendingCount = await InKindDonation.countDocuments({ ...query, status: 'pending' });
  const scheduledCount = await InKindDonation.countDocuments({ ...query, status: 'scheduled' });
  const completedCount = await InKindDonation.countDocuments({ ...query, status: 'completed' });

  res.status(200).json({
    success: true,
    stats: {
      pendingCount,
      scheduledCount,
      completedCount
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
    .populate('userId', 'firstName lastName email phone profilePictureUrl createdAt isApproved')
    .populate({
      path: 'joinedOpportunities',
      select: 'title description location date category status imageurl',
      populate: {
        path: 'partnerId',
        select: 'orgName organizationName'
      }
    });

  if (!profile) {
    return next(new ErrorResponse('Volunteer profile not found', 404));
  }

  // Fetch volunteer logs
  const logs = await VolunteerLog.find({ userId: profile.userId })
    .populate('opportunityId', 'title')
    .sort({ date: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      ...profile.toObject(),
      volunteerLogs: logs
    }
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

  // Normalize whatToBring to an array
  if (opportunityData.whatToBring) {
    if (typeof opportunityData.whatToBring === 'string') {
      try {
        opportunityData.whatToBring = JSON.parse(opportunityData.whatToBring);
      } catch (e) {
        opportunityData.whatToBring = opportunityData.whatToBring.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    
    // Ensure it's an array and flatten any internal comma-separated strings
    if (Array.isArray(opportunityData.whatToBring)) {
      opportunityData.whatToBring = opportunityData.whatToBring.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    } else {
      opportunityData.whatToBring = [opportunityData.whatToBring];
    }
  } else {
    opportunityData.whatToBring = [];
  }

  // Normalize requirements to an array
  if (opportunityData.requirements) {
    if (typeof opportunityData.requirements === 'string') {
      try {
        opportunityData.requirements = JSON.parse(opportunityData.requirements);
      } catch (e) {
        opportunityData.requirements = opportunityData.requirements.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    
    // Ensure it's an array and flatten any internal comma-separated strings
    if (Array.isArray(opportunityData.requirements)) {
      opportunityData.requirements = opportunityData.requirements.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    } else {
      opportunityData.requirements = [opportunityData.requirements];
    }
  } else {
    opportunityData.requirements = [];
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
  
  // Normalize whatToBring to an array
  if (updates.whatToBring) {
    if (typeof updates.whatToBring === 'string') {
      try {
        updates.whatToBring = JSON.parse(updates.whatToBring);
      } catch (e) {
        updates.whatToBring = updates.whatToBring.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    // Ensure it's an array and flatten any internal comma-separated strings
    if (Array.isArray(updates.whatToBring)) {
      updates.whatToBring = updates.whatToBring.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    } else {
      updates.whatToBring = [updates.whatToBring];
    }
  } else if (req.body.whatToBring === '') {
     // If explicitly sent as empty string, clear the array
     updates.whatToBring = [];
  }

  // Normalize requirements to an array
  if (updates.requirements) {
    if (typeof updates.requirements === 'string') {
      try {
        updates.requirements = JSON.parse(updates.requirements);
      } catch (e) {
        updates.requirements = updates.requirements.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    // Ensure it's an array and flatten any internal comma-separated strings
    if (Array.isArray(updates.requirements)) {
      updates.requirements = updates.requirements.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    } else {
      updates.requirements = [updates.requirements];
    }
  } else if (req.body.requirements === '') {
     // If explicitly sent as empty string, clear the array
     updates.requirements = [];
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

  // Update Profile background check status if disapproving
  if (!isApproved) {
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

  // OneSignal Notification
  await sendNotification(
    profile.userId,
    isApproved ? 'Account Approved' : 'Account Update',
    isApproved ? 'Your volunteer account has been approved.' : 'Your volunteer account approval has been revoked.',
    isApproved ? 'approval' : 'update',
    isApproved ? 'checkmark' : 'info'
  );

  res.status(200).json({
    success: true,
    message: `Volunteer ${isApproved ? 'approved' : 'disapproved'} successfully.`,
    data: { isApproved }
  });
});

/**
 * @desc    Approve or Disapprove a participant (Account Approval)
 * @route   PATCH /api/admin/participants/:id/approve
 * @access  Private (Admin only)
 */
const adminApproveParticipant = asyncHandler(async (req, res, next) => {
  const { isApproved } = req.body;
  
  const profile = await ParticipantProfile.findByIdAndUpdate(
    req.params.id,
    { accountStatus: isApproved ? 'PENDING' : 'INACTIVE' },
    { new: true, runValidators: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Participant profile not found', 404));
  }

  // Update User model
  await User.findByIdAndUpdate(profile.userId, { isApproved });

  // Activity Log
  await ActivityLog.create({
    userId: profile.userId,
    type: 'Submission Approved',
    content: isApproved ? 'Your participant account has been approved.' : 'Your participant account approval has been revoked.',
    relatedId: profile._id,
    relatedModel: 'ParticipantProfile',
  });

  // OneSignal Notification
  await sendNotification(
    profile.userId,
    isApproved ? 'Account Approved' : 'Account Update',
    isApproved ? 'Your participant account has been approved.' : 'Your participant account approval has been revoked.',
    isApproved ? 'approval' : 'update',
    isApproved ? 'checkmark' : 'info'
  );

  res.status(200).json({
    success: true,
    message: `Participant ${isApproved ? 'approved' : 'disapproved'} successfully.`,
    data: profile
  });
});

/**
 * @desc    Approve Detailed Intake for a participant
 * @route   PATCH /api/admin/participants/:id/approve-detailed
 * @access  Private (Admin only)
 */
const adminApproveDetailedIntake = asyncHandler(async (req, res, next) => {
  const profile = await ParticipantProfile.findByIdAndUpdate(
    req.params.id,
    {
      'intakeStatus.status': 'Completed',
      accountStatus: 'ACTIVE',
      isIntakeApproved: true
    },
    { new: true, runValidators: true }
  );

  if (!profile) {
    return next(new ErrorResponse('Participant profile not found', 404));
  }

  // Also approve the user account when detailed intake is completed
  await User.findByIdAndUpdate(profile.userId, { isApproved: true });

  // Activity Log
  await ActivityLog.create({
    userId: profile.userId,
    type: 'Profile Updated',
    content: 'Your detailed intake information has been approved and your account is now fully active.',
    relatedId: profile._id,
    relatedModel: 'ParticipantProfile',
  });

  // OneSignal Notification
  await sendNotification(
    profile.userId,
    'Intake Approved',
    'Your detailed intake information has been approved and your account is now fully active.',
    'approval',
    'checkmark'
  );

  res.status(200).json({
    success: true,
    message: 'Detailed intake approved successfully.',
    data: profile
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
 * @desc    Get social links from system settings
 * @route   GET /api/admin/settings/social-links
 * @access  Public
 */
const getSocialLinks = asyncHandler(async (req, res, next) => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({});
  }
  
  res.status(200).json({
    success: true,
    data: settings.socialLinks
  });
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

  console.log('DEBUG: Received file upload request');
  console.log('DEBUG: req.file details:', JSON.stringify(req.file, null, 2));

  // Fix Cloudinary PDF URL: PDFs need /raw/upload/ instead of /image/upload/
  let fileUrl = req.file.path;
  if (fileUrl && fileUrl.includes('/image/upload/') && (fileUrl.endsWith('.pdf') || req.file.mimetype === 'application/pdf')) {
    fileUrl = fileUrl.replace('/image/upload/', '/raw/upload/');
    console.log('DEBUG: Transformed PDF URL to raw:', fileUrl);
  }

  let settings = await SystemSettings.findOne();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  if (!settings) {
    settings = await SystemSettings.create({
      agreementUrl: fileUrl,
      activeAgreementVersion: `v1.0.0 (${dateStr})`,
    });
  } else {
    let currentVersion = settings.activeAgreementVersion || 'v1.0.0';
    let versionNum = currentVersion.split(' ')[0];
    
    const versionMatch = versionNum.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      let major = parseInt(versionMatch[1]);
      let minor = parseInt(versionMatch[2]);
      let patch = parseInt(versionMatch[3]);
      patch += 1;
      versionNum = `v${major}.${minor}.${patch}`;
    } else {
      versionNum = 'v1.0.1';
    }

    settings.agreementUrl = fileUrl;
    settings.activeAgreementVersion = `${versionNum} (${dateStr})`;
    await settings.save();
  }

  // Record in History
  console.log('DEBUG: Preparing AgreementHistory payload');
  const historyData = {
    version: settings.activeAgreementVersion,
    url: req.file.path,
    uploadedBy: req.user?._id || req.user?.id,
    changeLog: req.body.changeLog || 'New agreement version uploaded'
  };
  console.log('DEBUG: historyData:', JSON.stringify(historyData, null, 2));

  try {
    const historyEntry = await AgreementHistory.create(historyData);
    console.log('DEBUG: SUCCESS! History entry ID:', historyEntry._id);
  } catch (err) {
    console.error('DEBUG: FAILED to create AgreementHistory record:', err.message);
    console.error('DEBUG: Full error:', err);
  }

  res.status(200).json({
    success: true,
    data: settings,
  });
});

/**
 * @desc    Get agreement upload history
 * @route   GET /api/admin/settings/agreement/history
 * @access  Private (Admin only)
 */
const getAgreementHistory = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  console.log('DEBUG: Fetching Agreement History, page:', page);
  const total = await AgreementHistory.countDocuments();
  console.log('DEBUG: Total history records in DB:', total);
  
  const history = await AgreementHistory.find()
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  console.log('DEBUG: History records found:', history.length);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: history,
  });
});


/**
 * @desc    View/Download agreement PDF (proxied via signed Cloudinary URL)
 * @route   GET /api/admin/settings/agreement/view
 * @access  Private (Admin only)
 */
const viewAgreementPdf = asyncHandler(async (req, res, next) => {
  const cloudinary = require('../utils/cloudinary');
  
  // If a specific URL is provided via query, use it; otherwise use the current agreement
  let pdfUrl = req.query.url;

  if (!pdfUrl) {
    const settings = await SystemSettings.findOne();
    if (!settings || !settings.agreementUrl) {
      return next(new ErrorResponse('No agreement found', 404));
    }
    pdfUrl = settings.agreementUrl;
  }

  // Extract public_id from the Cloudinary URL
  // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{public_id}.pdf
  const urlParts = pdfUrl.split('/upload/');
  if (urlParts.length < 2) {
    return next(new ErrorResponse('Invalid agreement URL format', 400));
  }

  // Get everything after /upload/v{version}/ — e.g. "v1773397835/our-hive/filename.pdf"
  let pathAfterUpload = urlParts[1];
  // Remove version prefix (v1234567890/)
  pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
  // Remove .pdf extension to get the public_id
  const publicId = pathAfterUpload.replace(/\.pdf$/i, '');

  console.log('DEBUG: Generating signed URL for public_id:', publicId);

  // Generate a signed URL that bypasses access restrictions
  const signedUrl = cloudinary.url(publicId, {
    resource_type: 'image',
    type: 'upload',
    sign_url: true,
    format: 'pdf',
  });

  console.log('DEBUG: Signed URL generated:', signedUrl);

  // Redirect the browser to the signed URL
  res.redirect(signedUrl);
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
  const { firstName, lastName, email, phone } = req.body;
  
  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (email) updateData.email = email;
  
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

/**
 * @desc    List all monetary donations (Admin)
 * @route   GET /api/admin/donations/monetary
 * @access  Private (Admin only)
 */
const adminListMonetaryDonations = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status, search } = req.query;

  const query = {};
  if (status) query.status = status;
  
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    query.$or = [
      { projectTitle: regex },
      { transactionId: regex }
    ];
  }

  const total = await MonetaryDonation.countDocuments(query);
  const donations = await MonetaryDonation.find(query)
    .populate('sponsorId', 'firstName lastName email')
    .populate('eventId', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: donations.length,
    data: donations
  });
});

/**
 * @desc    Approve a monetary donation (Admin)
 * @route   PATCH /api/admin/donations/monetary/:id/approve
 * @access  Private (Admin only)
 */
const adminApproveMonetaryDonation = asyncHandler(async (req, res, next) => {
  const { transactionId } = req.body;
  const donation = await MonetaryDonation.findById(req.params.id);

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  if (donation.status === 'completed') {
    return next(new ErrorResponse('Donation is already approved/completed', 400));
  }

  donation.status = 'completed';
  if (transactionId) {
    donation.transactionId = transactionId;
  }
  
  // Calculate meals provided ($2.50 = 1 meal)
  donation.mealsProvided = Math.floor(donation.amount / 2.5);
  
  await donation.save();

  // If there's a campaign associated, we should update the raisedAmount
  if (donation.eventId) {
    await require('../models/Campaign').findByIdAndUpdate(donation.eventId, {
      $inc: { raisedAmount: donation.amount }
    });
  }

  // Update Sponsor/User total contributed if applicable
  const sponsor = await Sponsor.findOne({ userId: donation.sponsorId });
  if (sponsor) {
    const newTotal = sponsor.totalContributed + donation.amount;
    sponsor.totalContributed = newTotal;
    sponsor.tier = Sponsor.getTier(newTotal);
    if (donation.isMonthly) {
        sponsor.isMonthlySupporter = true;
    }
    await sponsor.save();
  }

  // OneSignal Notification
  await sendNotification(
    donation.sponsorId,
    'Donation Verified',
    `Thank you! Your donation of $${donation.amount} has been verified as received.`,
    'approval',
    'checkmark'
  );

  res.status(200).json({
    success: true,
    message: 'Donation approved successfully',
    data: donation
  });
});

/**
 * @desc    Get single monetary donation detail (Admin)
 * @route   GET /api/admin/donations/monetary/:id
 * @access  Private (Admin only)
 */
const adminGetMonetaryDonation = asyncHandler(async (req, res, next) => {
  const donation = await MonetaryDonation.findById(req.params.id)
    .populate('sponsorId', 'firstName lastName email profilePictureUrl phone')
    .populate('eventId', 'title description date location category');

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  res.status(200).json({
    success: true,
    data: donation
  });
});

/**
 * @desc    Get all badges
 * @route   GET /api/admin/badges
 * @access  Private (Admin only)
 */
const adminListBadges = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await Badge.countDocuments();
  const badges = await Badge.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    count: badges.length,
    data: badges,
  });
});

/**
 * @desc    Get single badge
 * @route   GET /api/admin/badges/:id
 * @access  Private (Admin only)
 */
const adminGetBadge = asyncHandler(async (req, res, next) => {
  const badge = await Badge.findById(req.params.id);

  if (!badge) {
    return next(new ErrorResponse('Badge not found', 404));
  }

  res.status(200).json({
    success: true,
    data: badge,
  });
});

/**
 * @desc    Create a badge
 * @route   POST /api/admin/badges
 * @access  Private (Admin only)
 */
const adminCreateBadge = asyncHandler(async (req, res, next) => {
  const badgeData = { ...req.body };

  if (req.file) {
    badgeData.imageUrl = req.file.path || req.file.secure_url || req.file.url;
  }

  const badge = await Badge.create(badgeData);

  res.status(201).json({
    success: true,
    data: badge,
  });
});

/**
 * @desc    Update a badge
 * @route   PATCH /api/admin/badges/:id
 * @access  Private (Admin only)
 */
const adminUpdateBadge = asyncHandler(async (req, res, next) => {
  const badgeData = { ...req.body };

  if (req.file) {
    badgeData.imageUrl = req.file.path || req.file.secure_url || req.file.url;
  }

  const badge = await Badge.findByIdAndUpdate(req.params.id, badgeData, {
    new: true,
    runValidators: true,
  });

  if (!badge) {
    return next(new ErrorResponse('Badge not found', 404));
  }

  res.status(200).json({
    success: true,
    data: badge,
  });
});

/**
 * @desc    Delete a badge
 * @route   DELETE /api/admin/badges/:id
 * @access  Private (Admin only)
 */
const adminDeleteBadge = asyncHandler(async (req, res, next) => {
  const badge = await Badge.findByIdAndDelete(req.params.id);

  if (!badge) {
    return next(new ErrorResponse('Badge not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Badge deleted successfully',
    data: {},
  });
});

// Force restart - 15:15
module.exports = { 
  getAllUsers, 
  getDashboard, 
  updatePartnerStatus, 
  updateOpportunityStatus,
  addVolunteerHours, 
  adminApproveVolunteerHours,
  getFinances, 
  getParticipantSummary,
  adminListParticipants,
  adminGetParticipant,
  adminUpdateParticipant,
  adminDeactivateParticipant,
  adminRevokeDetailedIntake,
  adminExportParticipantsCSV,
  adminApproveParticipant,
  adminApproveDetailedIntake,
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
  adminListMonetaryDonations,
  adminApproveMonetaryDonation,
  adminGetMonetaryDonation,
  adminGetSettings,
  getSocialLinks,
  adminUpdateSettings,
  adminGetProfile,
  adminUpdateProfile,
  adminUpdatePassword,
  adminUploadAgreement,
  getAgreementHistory,
  viewAgreementPdf,
  adminDeletePartner,
  adminUpdateBadge,
  adminDeleteBadge,
  adminListBadges,
  adminGetBadge,
  adminCreateBadge,
  adminListPartnerPickups,
  updateUserRole,
};
