const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const DonorProfile = require('../models/DonorProfile');
const ParticipantProfile = require('../models/ParticipantProfile');
const PartnerProfile = require('../models/PartnerProfile');
const ActivityLog = require('../models/ActivityLog');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const cloudinary = require('../utils/cloudinary');
const { notifyAdmins, sendNotification, sendWelcomeNotification } = require('../utils/notificationService');

// Helper to send token response
const sendTokenResponse = async (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const responseData = {
    success: true,
    message: 'Login successful',
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
  };
  if (user.role === 'participant') {
    const participantProfile = await ParticipantProfile.findOne({ userId: user._id });
    if (participantProfile) {
      responseData.user.isIntakeApproved = participantProfile.isIntakeApproved;
      responseData.user.intakeStatus = participantProfile.intakeStatus;
    }
  }

  res.status(statusCode).json(responseData);
};

const register = asyncHandler(async (req, res, next) => {
  let { firstName, lastName, fullName, email, password, phone, role, mailingAddress, skills, availability, playerId } = req.body;
  console.log('\n========== REGISTRATION START ==========');
  console.log('1. Received entire request body:', req.body);
  console.log('   - phone value:', phone, '| type:', typeof phone);
  console.log('   - mailingAddress value:', mailingAddress, '| type:', typeof mailingAddress);
  console.log('   - role value:', role);
  // Handle single "fullName" field from UI if firstName/lastName missing
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.trim().split(' ');
    if (!firstName) firstName = parts[0] || '';
    if (!lastName) lastName = parts.slice(1).join(' ') || '';
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
  console.log('\n2. About to create User document with:', {
    firstName,
    lastName,
    email,
    phone,
    role: role || 'visitor',
    isApproved: role === 'sponsor' ? true : false,
    mailingAddress,
  });
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role: role || 'visitor',
    isApproved: role === 'sponsor' ? true : false,
    mailingAddress,
    preferences: {
      notificationEnabled: true,
      language: 'English',
      oneSignalUserId: playerId || ''
    }
  });
  console.log('3. User CREATED in database:');
  console.log('   - _id:', user._id);
  console.log('   - phone (in DB):', user.phone);
  console.log('   - mailingAddress (in DB):', user.mailingAddress);
  console.log('   - role:', user.role);
  console.log('   - Full user object:', JSON.stringify(user, null, 2));

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
    case 'donor':
      await DonorProfile.create({ 
        userId: user._id,
        phone: phone || user.phone,
        mailingAddress: mailingAddress,
        isApproved: true
      });
      break;
    case 'participant':
      await ParticipantProfile.create({ userId: user._id });
      break;
  }

  // Create Activity Log
  if (['volunteer', 'partner', 'participant', 'donor', 'sponsor'].includes(user.role)) {
    let type = 'New Registration';
    if (user.role === 'volunteer') type = 'New Volunteer Interest';
    if (user.role === 'participant') type = 'New Participant Intake';
    if (user.role === 'partner') type = 'New Partner Registration';
    if (user.role === 'sponsor') type = 'New Sponsor Registration';
    if (user.role === 'donor') type = 'New Donor Registration';

    await ActivityLog.create({
      userId: user._id,
      type,
      content: `${firstName} ${lastName} has registered as a ${user.role}.`,
      relatedId: user._id,
      relatedModel: user.role === 'participant' ? 'ParticipantProfile' : 
                   (user.role === 'volunteer' ? 'VolunteerProfile' : 
                   (user.role === 'partner' ? 'PartnerProfile' : 
                   (user.role === 'donor' ? 'DonorProfile' : 'Sponsor')))
    });

    // Notify Admins
    await notifyAdmins(
      'New User Registration',
      `${user.firstName} ${user.lastName} has registered as a ${user.role}.`
    );

    // Send Welcome Notification to User
    await sendWelcomeNotification(user._id, user.firstName, user.role);
  }

  await sendTokenResponse(user, 201, res);
});

/**
 * @desc    Consolidated Volunteer Registration
 * @route   POST /api/auth/volunteer-register
 * @access  Public
 */
const volunteerRegister = asyncHandler(async (req, res, next) => {
  console.log('--- Volunteer Registration Started ---');
  let { firstName, lastName, fullName, email, password, phone, skills, availability, mailingAddress, playerId } = req.body;
  console.log('Received body:', req.body);

  // Handle single "fullName" field from UI if firstName/lastName missing
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.trim().split(' ');
    if (!firstName) firstName = parts[0] || '';
    if (!lastName) lastName = parts.slice(1).join(' ') || '';
    console.log('Parsed names from fullName:', { firstName, lastName });
  }

  // Check if email or phone already exists
  console.log('Checking if email already exists:', email);
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    console.log('Email already exists:', email);
    return next(new ErrorResponse('A user with that email already exists', 400));
  }

  if (phone) {
    console.log('Checking if phone already exists:', phone);
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      console.log('Phone already exists:', phone);
      return next(new ErrorResponse('A user with that phone number already exists', 400));
    }
  }

  // Handle stringified fields from multipart/form-data
  if (typeof skills === 'string') {
    try {
      skills = skills.startsWith('[') ? JSON.parse(skills) : skills.split(',').map(s => s.trim());
    } catch (e) {
      console.log('Error parsing skills JSON, falling back to comma split:', e);
      skills = skills.split(',').map(s => s.trim());
    }
  }
  console.log('Processed skills:', skills);

  if (typeof availability === 'string') {
    try {
      availability = JSON.parse(availability);
    } catch (e) {
      console.error("Error parsing availability JSON:", e);
    }
  }

  // Handle availability as array (commonly sent from Flutter checkbox lists)
  if (Array.isArray(availability)) {
    console.log('Detected availability as array, converting to object...');
    const availObj = { morning: false, afternoon: false, evenings: false, weekend: false };
    availability.forEach(item => {
      const lower = item.toString().toLowerCase();
      if (lower.includes('morning')) availObj.morning = true;
      if (lower.includes('afternoon')) availObj.afternoon = true;
      if (lower.includes('evening')) availObj.evenings = true;
      if (lower.includes('weekend')) availObj.weekend = true;
    });
    availability = availObj;
  }
  console.log('Processed availability:', availability);

  // Create user - Volunteers are NOT approved by default
  console.log('Processing files and creating user...');

  // Handle uploaded files
  let governmentIdUrl = '';
  let drivingLicenseUrl = '';
  let profilePictureUrl = '';

  // 1. Check for files in req.files (multipart upload from Web or Flutter)
  if (req.files) {
    console.log('Files received in req.files:', Object.keys(req.files));
    if (req.files.governmentId) {
      governmentIdUrl = req.files.governmentId[0].path;
      console.log('✅ Government ID received as file:', governmentIdUrl);
    }
    if (req.files.drivingLicense) {
      drivingLicenseUrl = req.files.drivingLicense[0].path;
      console.log('✅ Driving License received as file:', drivingLicenseUrl);
    }
    if (req.files.profilePicture) {
      profilePictureUrl = req.files.profilePicture[0].path;
      console.log('✅ Profile Picture received as file:', profilePictureUrl);
    }
  }

  // 2. Check for base64 images in req.body (mobile app fallback)
  const { governmentId, drivingLicense, profilePicture } = req.body;

  // Helper for base64/local path upload
  const uploadToCloudinary = async (source, folder) => {
    // If we already have a URL from req.files, or source is empty/already a URL, skip
    if (!source || typeof source !== 'string' || source.startsWith('http')) return source;

    // SANITY CHECK: Detect if client is sending a local mobile path string incorrectly
    if (source.startsWith('/data/user/') || source.startsWith('/var/mobile/') || source.startsWith('cache/')) {
      console.error(`❌ CLIENT ERROR: Mobile app sent a local device path instead of a file upload or base64: ${source}`);
      return '';
    }

    try {
      console.log(`Starting Cloudinary upload to ${folder}...`);
      const result = await cloudinary.uploader.upload(source, {
        folder: folder,
        resource_type: 'auto',
        quality: 'auto',
      });
      return result.secure_url;
    } catch (error) {
      console.error(`❌ Cloudinary Upload Error in ${folder}:`, error.message || error);
      return '';
    }
  };

  if (!governmentIdUrl && governmentId) {
    governmentIdUrl = await uploadToCloudinary(governmentId, 'volunteer-documents');
  }
  if (!drivingLicenseUrl && drivingLicense) {
    drivingLicenseUrl = await uploadToCloudinary(drivingLicense, 'volunteer-documents');
  }
  if (!profilePictureUrl && profilePicture) {
    profilePictureUrl = await uploadToCloudinary(profilePicture, 'volunteer-profiles');
  }

  console.log('Creating user...');
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role: 'volunteer',
    isApproved: false,
    mailingAddress,
    profilePictureUrl,
    preferences: {
      notificationEnabled: true,
      language: 'English',
      oneSignalUserId: playerId || ''
    }
  });
  console.log('User created:', { id: user._id, email: user.email });

  // Create Volunteer Profile
  console.log('Creating volunteer profile...');
  const profile = await VolunteerProfile.create({
    userId: user._id,
    fullName: fullName || `${firstName} ${lastName}`,
    phone: phone || user.phone,
    skills: skills || [],
    availability: availability || {
      morning: false,
      afternoon: false,
      evenings: false,
      weekend: false
    },
    governmentIdUrl,
    drivingLicenseUrl,
    profilePictureUrl,
    backgroundCheckStatus: 'Pending'
  });
  console.log('Volunteer profile created:', { id: profile._id, userId: profile.userId });

  // Create Activity Log
  await ActivityLog.create({
    userId: user._id,
    type: 'New Volunteer Interest',
    content: `${firstName} ${lastName} has registered as a volunteer.`,
    relatedId: profile._id,
    relatedModel: 'VolunteerProfile'
  });

  // Notify Admins
  await notifyAdmins(
    'New Volunteer Registration',
    `${firstName} ${lastName} has registered as a volunteer and is pending approval.`
  );

  // Send Welcome Notification to Volunteer
  await sendWelcomeNotification(user._id, firstName, 'volunteer');

  // Return success response
  const token = user.getSignedJwtToken();
  console.log('Registration successful, sending response.');
  res.status(201).json({
    success: true,
    token,
    message: 'Volunteer registration submitted successfully. Your account is pending admin approval.',
    user: {
      _id: user._id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved
    },
    profile: {
      governmentIdUrl: profile.governmentIdUrl || '',
      drivingLicenseUrl: profile.drivingLicenseUrl || '',
      profilePictureUrl: profile.profilePictureUrl || ''
    }
  });
});

/**
 * @desc    Participant Registration
 * @route   POST /api/auth/participant-register
 * @access  Public
 */
const participantRegister = asyncHandler(async (req, res, next) => {
  console.log('--- Participant Registration Started ---');
  let { fullName, email, password, phone, mailingAddress, playerId } = req.body;
  console.log('Received body:', req.body);

  // Validate required fields
  if (!fullName || !email || !password || !phone) {
    return next(new ErrorResponse('Please provide fullName, email, password, and phone', 400));
  }

  // Handle single "fullName" field from UI
  let firstName, lastName;
  const parts = fullName.trim().split(' ');
  firstName = parts[0] || '';
  lastName = parts.slice(1).join(' ') || 'User';

  // Check if email or phone already exists
  console.log('Checking if email already exists:', email);
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    console.log('Email already exists:', email);
    return next(new ErrorResponse('A user with that email already exists', 400));
  }

  console.log('Checking if phone already exists:', phone);
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    console.log('Phone already exists:', phone);
    return next(new ErrorResponse('A user with that phone number already exists', 400));
  }

  // Create user
  console.log('Creating user...');
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role: 'participant',
    mailingAddress,
    isApproved: false, // Participants need approval
    preferences: {
      notificationEnabled: true,
      language: 'English',
      oneSignalUserId: playerId || ''
    }
  });

  console.log('User created:', { id: user._id, email: user.email });

  // Create Participant Profile
  console.log('Creating participant profile...');
  await ParticipantProfile.create({
    userId: user._id,
  });

  // Notify Admins
  await notifyAdmins(
    'New Participant Registration',
    `${firstName} ${lastName} has registered as a participant.`
  );

  // Send Welcome Notification to Participant
  await sendWelcomeNotification(user._id, firstName, 'participant');

  console.log('Participant registration completed successfully');

  await sendTokenResponse(user, 201, res);
});

/**
 * @desc    Consolidated Partner Registration
 * @route   POST /api/auth/partner-register
 * @access  Public
 */
const partnerRegister = asyncHandler(async (req, res, next) => {
  
    console.log("=== Partner Register API Hit ===");
  
  // Log entire request body
  console.log("Full request body:", JSON.stringify(req.body, null, 2));
  
  // Optional: log all keys coming in
  console.log("Keys in request body:", Object.keys(req.body));
  let {
    firstName,
    lastName,
    fullName,
    name,
    email,
    password,
    phone,
    orgName,
    orgType,
    orgAddress,
    website,
    intendedRoles,
    playerId
  } = req.body;

  
  // Handle name field
  if (name && (!firstName || !lastName)) {
    const parts = name.trim().split(" ");
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || "";
  }

  // Handle fullName field
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.trim().split(" ");
    if (!firstName) firstName = parts[0] || "";
    if (!lastName) lastName = parts.slice(1).join(" ") || "";
  }

  // Check if email exists
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return next(new ErrorResponse("A user with that email already exists", 400));
  }

  // Check phone if provided
  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return next(
        new ErrorResponse("A user with that phone number already exists", 400)
      );
    }
  }

  // Create user
  const user = await User.create({
    firstName: firstName || "",
    lastName: lastName || "",
    oneSignalUserId: playerId || "",
    email,
    password,
    phone,
    role: "partner",
    isApproved: false
  });

  // Parse intended roles
  let roles = [];
  if (Array.isArray(intendedRoles)) {
    roles = intendedRoles;
  } else if (typeof intendedRoles === "string") {
    roles = intendedRoles.split(",").map((r) => r.trim());
  }

  // Create partner profile
  const partnerProfile = await PartnerProfile.create({
    userId: user._id,
    name: `${firstName || ""} ${lastName || ""}`.trim(),
    orgName,
    orgType,
    address: orgAddress,
    website,
    intendedRoles: roles,
    status: "Pending"
  });

  // Create activity log
  await ActivityLog.create({
    userId: user._id,
    type: "New Partner Registration",
    content: `${firstName || ""} ${lastName || ""} has registered as a community partner for "${orgName}".`,
    relatedId: partnerProfile._id,
    relatedModel: "PartnerProfile"
  });

  // Notify admins
  await notifyAdmins(
    "New Partner Registration",
    `${firstName || ""} ${lastName || ""} has registered as a partner for "${orgName}".`
  );

  // Send Welcome Notification to Partner
  await sendWelcomeNotification(user._id, firstName || "Partner", 'partner');

  // Notify partner
  await sendNotification(
    user._id,
    "Partnership Registration Submitted",
    `Welcome! Your partnership registration for "${orgName}" has been submitted successfully. Our team will review your application and get back to you soon.`,
    "system",
    "checkmark"
  );

  const token = user.getSignedJwtToken();

  res.status(201).json({
    success: true,
    token,
    message:
      "Partner registration submitted successfully. Your account is pending admin approval.",
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isApproved: user.isApproved
    }
  });
});
/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password, playerId } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new ErrorResponse('Please provide both email and password', 400));
  }

  // Find user with password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  console.log("Player ID:", playerId);

  // Check password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Save OneSignal Player ID if provided
  if (playerId) {
    user.preferences.oneSignalUserId = playerId;
    await user.save({ validateBeforeSave: false });
  }

  // Check volunteer or partner approval status
  if ((user.role === 'volunteer' || user.role === 'partner') && !user.isApproved) {
    return res.json({
      Status: 200,
      Isapproved: false,
      role: user.role,
      success: false,
      message:
        'Your account is pending approval by the admin. Please wait for confirmation before logging in.',
    });
  }

  // Send token response
  await sendTokenResponse(user, 200, res);
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

  await sendTokenResponse(user, 200, res);
});

module.exports = { register, volunteerRegister, participantRegister, partnerRegister, login, logout, checkAvailability, forgotPassword, resetPassword };
