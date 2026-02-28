const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const ParticipantProfile = require('../models/ParticipantProfile');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');

// Helper to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      createdAt: user.createdAt,
    },
  });
};

const register = asyncHandler(async (req, res, next) => {
  let { firstName, lastName, fullName, email, password, phone, role, mailingAddress, skills, availability } = req.body;

  // Handle single "fullName" field from UI if firstName/lastName missing
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.trim().split(' ');
    if (!firstName) firstName = parts[0] || '';
    if (!lastName) lastName = parts.slice(1).join(' ') || 'User';
  }

  // Check if email or phone already exists
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return next(new ErrorResponse('A user with that email already exists', 400));
  }

  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return next(new ErrorResponse('A user with that phone number already exists', 400));
    }
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role: role || 'visitor',
    mailingAddress,
  });

  // Create empty profile based on role
  switch (user.role) {
    case 'volunteer':
      await VolunteerProfile.create({ 
        userId: user._id,
        fullName: fullName || `${firstName} ${lastName}`,
        phone: phone || user.phone,
        skills: skills || [],
        availability: availability || {
          morning: false,
          afternoon: false,
          evenings: false,
          weekend: false
        }
      });
      break;
    case 'sponsor':
      await Sponsor.create({ userId: user._id });
      break;
    case 'participant':
      await ParticipantProfile.create({ userId: user._id });
      break;
  }

  sendTokenResponse(user, 201, res);
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new ErrorResponse('Please provide both email and password', 400));
  }

  // Find user with password field included
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

/**
 * @desc    Logout user
 * @route   GET /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

/**
 * @desc    Check availability of email or phone
 * @route   GET /api/auth/check-availability
 * @access  Public
 */
const checkAvailability = asyncHandler(async (req, res, next) => {
  const { email, phone } = req.query;

  if (!email && !phone) {
    return next(new ErrorResponse('Please provide either an email or a phone number to check', 400));
  }

  let query = {};
  if (email) query.email = email.toLowerCase();
  if (phone) query.phone = phone;

  const existingUser = await User.findOne(query);

  res.status(200).json({
    success: true,
    available: !existingUser,
    field: email ? 'email' : 'phone',
  });
});

const crypto = require('crypto');

/**
 * @desc    Initiate password reset — generates a token and logs reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new ErrorResponse('Please provide an email address', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new ErrorResponse('No account found with that email address', 404));
  }

  // Generate reset token using the User model method
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Construct reset URL (frontend should handle this route)
  const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

  // Construct email message
  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
  const html = `<p>You are receiving this email because you (or someone else) has requested the reset of a password. Please click the link below to reset your password:</p><a href="${resetUrl}" clicktracking=off>${resetUrl}</a>`;

  try {
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Token',
      message,
      html
    });

    res.status(200).json({
      success: true,
      data: 'Email sent'
    });
  } catch (err) {
    console.error(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

/**
 * @desc    Reset password using the token from the email link
 * @route   PUT /api/auth/reset-password/:resetToken
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res, next) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return next(new ErrorResponse('Password must be at least 6 characters', 400));
  }

  // Hash the incoming token to compare against the stored hash
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset token', 400));
  }

  // Set the new password and clear the reset fields
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

module.exports = { register, login, logout, checkAvailability, forgotPassword, resetPassword };
