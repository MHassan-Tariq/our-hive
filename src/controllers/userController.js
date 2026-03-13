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
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Map notifications to only include required fields
  const mapNotification = (n) => ({
    id: n._id,           // Added id
    title: n.title,
    message: n.message,
    type: n.type,
    iconType: n.iconType,
    isRead: n.isRead,
    createdAt: n.createdAt,
  });

  const segmented = {
    newUpdates: notifications
      .filter(n => !n.isRead && n.createdAt > twentyFourHoursAgo)
      .map(mapNotification),
    earlier: notifications
      .filter(n => n.isRead || n.createdAt <= twentyFourHoursAgo)
      .map(mapNotification),
  };

  res.status(200).json({
    success: true,
    unreadCount,
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

  // Get updated list
  const notifications = await Notification.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const mapNotification = (n) => ({
    id: n._id,
    title: n.title,
    message: n.message,
    type: n.type,
    iconType: n.iconType,
    isRead: n.isRead,
    createdAt: n.createdAt,
  });

  const segmented = {
    newUpdates: notifications
      .filter(n => !n.isRead && n.createdAt > twentyFourHoursAgo)
      .map(mapNotification),
    earlier: notifications
      .filter(n => n.isRead || n.createdAt <= twentyFourHoursAgo)
      .map(mapNotification),
  };

  res.status(200).json({
    success: true,
    unreadCount,
    data: segmented,
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/user/notifications/read-all
 * @access  Private
 */
exports.markAllNotificationsAsRead = asyncHandler(async (req, res, next) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true }
  );

  // Get updated list
  const notifications = await Notification.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const mapNotification = (n) => ({
    id: n._id,
    title: n.title,
    message: n.message,
    type: n.type,
    iconType: n.iconType,
    isRead: n.isRead,
    createdAt: n.createdAt,
  });

  const segmented = {
    newUpdates: notifications
      .filter(n => !n.isRead && n.createdAt > twentyFourHoursAgo)
      .map(mapNotification),
    earlier: notifications
      .filter(n => n.isRead || n.createdAt <= twentyFourHoursAgo)
      .map(mapNotification),
  };

  res.status(200).json({
    success: true,
    unreadCount: 0,
    data: segmented,
  });
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
  // compute full name for consistency
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

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
      fullName,
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
 * @desc    Update push token (OneSignal Player ID)
 * @route   PATCH /api/user/push-token
 * @access  Private
 */
exports.updatePushToken = asyncHandler(async (req, res, next) => {
  const { playerId } = req.body;

  if (!playerId) {
    return next(new ErrorResponse('Please provide a OneSignal Player ID', 400));
  }

  await User.findByIdAndUpdate(req.user._id, {
    $set: { 'preferences.oneSignalUserId': playerId }
  });

  res.status(200).json({
    success: true,
    message: 'Push token updated successfully'
  });
});

/**
 * @desc    Update user profile information
 * @route   PATCH /api/user/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  let { firstName, lastName, Name, phone, mailingAddress } = req.body;
  const updateData = {};

  // Handle fullName field - split into firstName and lastName
  if (Name && (!firstName || !lastName)) {
    const parts = Name.trim().split(' ');
    if (!firstName) firstName = parts[0] || '';
    if (!lastName) lastName = parts.slice(1).join(' ') || ' ';
  }

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

  // include fullName in returned document
  const result = user.toObject();
  result.fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  res.status(200).json({
    success: true,
    data: result,
  });
});
