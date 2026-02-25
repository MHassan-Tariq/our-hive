const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const ParticipantProfile = require('../models/ParticipantProfile');
const Notification = require('../models/Notification');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Upgrade from visitor to a specific role
 * @route   PATCH /api/user/select-role
 * @access  Private (Visitor only)
 */
exports.selectRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;
  const allowedRoles = ['volunteer', 'donor', 'sponsor', 'participant'];

  if (!allowedRoles.includes(role)) {
    return next(new ErrorResponse('Invalid role selection', 400));
  }

  if (req.user.role !== 'visitor') {
    return next(new ErrorResponse('User already has a specific role', 400));
  }

  // Update user role
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { role },
    { new: true }
  );

  // Create empty profile based on role
  switch (role) {
    case 'volunteer':
      await VolunteerProfile.create({ userId: user._id });
      break;
    case 'sponsor':
      await Sponsor.create({ userId: user._id });
      break;
    case 'participant':
      await ParticipantProfile.create({ userId: user._id });
      break;
  }

  res.status(200).json({
    success: true,
    message: `Role updated to ${role}`,
    data: user
  });
});

/**
 * @desc    Get user notifications
 * @route   GET /api/user/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res, next) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const segmented = {
    newUpdates: notifications.filter(
      (n) => !n.isRead && n.createdAt > twentyFourHoursAgo
    ),
    earlier: notifications.filter(
      (n) => n.isRead || n.createdAt <= twentyFourHoursAgo
    ),
  };

  res.status(200).json({
    success: true,
    data: segmented,
  });
});

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/user/notifications/:id/read
 * @access  Private
 */
exports.markNotificationAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }

  res.status(200).json({ success: true, data: notification });
});

/**
 * @desc    Get user settings and preferences
 * @route   GET /api/user/settings
 * @access  Private
 */
exports.getSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+preferences');
  let displayName = `${user.firstName} ${user.lastName}`;
  let subHeader = 'Account Settings';

  // Role-specific data for the UI
  if (user.role === 'sponsor') {
    const sponsor = await Sponsor.findOne({ userId: user._id });
    if (sponsor && sponsor.organizationName) {
      displayName = sponsor.organizationName;
    }
    subHeader = 'Sponsor Preference';
  } else if (user.role === 'donor') {
    subHeader = 'Donor Preference';
  } else if (user.role === 'volunteer') {
    subHeader = 'Volunteer Preference';
  } else if (user.role === 'partner') {
    subHeader = 'Partner Preference';
  }

  res.status(200).json({
    success: true,
    data: {
      displayName,
      subHeader,
      email: user.email,
      phone: user.phone,
      mailingAddress: user.mailingAddress,
      preferences: user.preferences,
    },
  });
});

/**
 * @desc    Update user settings/preferences
 * @route   PATCH /api/user/settings
 * @access  Private
 */
exports.updateSettings = asyncHandler(async (req, res, next) => {
  const { notificationEnabled, language } = req.body;
  const updateData = {};

  if (notificationEnabled !== undefined) {
    updateData['preferences.notificationEnabled'] = notificationEnabled;
  }
  if (language) {
    updateData['preferences.language'] = language;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: user.preferences,
  });
});

/**
 * @desc    Update user profile information
 * @route   PATCH /api/user/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, phone, mailingAddress } = req.body;
  const updateData = {};

  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone) updateData.phone = phone;
  if (mailingAddress) updateData.mailingAddress = mailingAddress;

  if (req.file) {
    updateData.profilePictureUrl = req.file.path;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: user,
  });
});
