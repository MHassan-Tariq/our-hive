const ParticipantProfile = require('../models/ParticipantProfile');
const Opportunity = require('../models/Opportunity');
const InKindDonation = require('../models/InKindDonation');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const crypto = require('crypto');

/**
 * @desc    Save/Update Participant Profile
 * @route   POST /api/participant/profile
 * @access  Private (Participant)
 */
exports.saveProfile = async (req, res) => {
  try {
    const { 
      firstName,
      lastName,
      phone,
      interests, 
      housingStatus, 
      address, 
      unhousedDetails,
      householdSize,
      childrenCount,
      seniorsCount,
      petsCount,
      dietaryRestrictions,
      isVeteran,
      hasDisability,
      monthlyIncome,
      citizenStatus,
      assistancePrograms,
      consentToInformationUse
    } = req.body;

    // Update User model if personal info is provided
    if (firstName || lastName || phone) {
      const userUpdates = {};
      if (firstName) userUpdates.firstName = firstName;
      if (lastName) userUpdates.lastName = lastName;
      if (phone) userUpdates.phone = phone;
      
      await User.findByIdAndUpdate(req.user._id, userUpdates, { new: true, runValidators: true });
    }

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { 
        interests, 
        housingStatus, 
        address, 
        unhousedDetails,
        householdSize,
        childrenCount,
        seniorsCount,
        petsCount,
        dietaryRestrictions,
        isVeteran,
        hasDisability,
        monthlyIncome,
        citizenStatus,
        assistancePrograms,
        consentToInformationUse
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get Participant Profile (Full Profile details)
 * @route   GET /api/participant/profile
 * @access  Private (Participant)
 */
exports.getParticipantProfile = async (req, res) => {
  try {
    const profile = await ParticipantProfile.findOne({ userId: req.user._id })
      .populate('userId', 'firstName lastName email phone profilePictureUrl');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    // Format the response to map nicely to the UI
    res.status(200).json({
      success: true,
      data: {
        personalInfo: {
          firstName: profile.userId.firstName,
          lastName: profile.userId.lastName,
          email: profile.userId.email,
          phone: profile.userId.phone || '',
          profilePictureUrl: profile.userId.profilePictureUrl || ''
        },
        participantId: profile.participantId,
        householdDetails: {
          householdSize: profile.householdSize,
          childrenCount: profile.childrenCount,
          seniorsCount: profile.seniorsCount,
          petsCount: profile.petsCount
        },
        address: profile.address,
        unhousedDetails: profile.unhousedDetails,
        housingStatus: profile.housingStatus,
        documents: profile.documents,
        intakeStatus: profile.intakeStatus,
        interests: profile.interests,
        dietaryRestrictions: profile.dietaryRestrictions,
        isVeteran: profile.isVeteran,
        hasDisability: profile.hasDisability,
        monthlyIncome: profile.monthlyIncome,
        citizenStatus: profile.citizenStatus,
        assistancePrograms: profile.assistancePrograms,
        consentToInformationUse: profile.consentToInformationUse,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get Personalized Feed
 * @route   GET /api/participant/my-feed
 * @access  Private (Participant)
 */
exports.getMyFeed = async (req, res) => {
  try {
    const profile = await ParticipantProfile.findOne({ userId: req.user._id });
    const interests = profile ? profile.interests : [];

    // Find matching opportunities
    const opportunities = await Opportunity.find({
      status: 'Active',
      category: { $in: interests }
    }).sort({ createdAt: -1 });

    // Find matching donations
    const donations = await InKindDonation.find({
      status: 'offered',
      itemCategory: { $in: interests }
    }).sort({ createdAt: -1 });

    // Combine and sort
    const feed = [...opportunities.map(o => ({ ...o._doc, type: 'opportunity' })), 
                  ...donations.map(d => ({ ...d._doc, type: 'donation' }))]
                  .sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      success: true,
      count: feed.length,
      data: feed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Request service and generate voucher
 * @route   POST /api/participant/request-service/:id
 * @access  Private (Participant)
 */
exports.requestService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    
    // Check if it's an opportunity or donation
    let service = await Opportunity.findById(serviceId);
    let serviceType = 'Opportunity';
    
    if (!service) {
      service = await InKindDonation.findById(serviceId);
      serviceType = 'InKindDonation';
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Generate unique hash for QR code
    const qrCodeData = crypto.createHash('sha256')
      .update(`${req.user._id}-${serviceId}-${Date.now()}`)
      .digest('hex');

    const voucher = {
      serviceId,
      serviceType,
      qrCodeData,
      status: 'Active'
    };

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { vouchers: voucher } },
      { new: true, upsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Voucher generated successfully',
      data: profile.vouchers[profile.vouchers.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
/**
 * @desc    Get Participant Dashboard Data
 * @route   GET /api/participant/dashboard
 * @access  Private (Participant)
 */
exports.getParticipantDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let profile = await ParticipantProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = await ParticipantProfile.create({ userId: req.user._id });
    }

    // Get community updates (active campaigns)
    const updates = await Campaign.find({ isActive: true })
      .select('title description imageUrl category createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get the next upcoming distribution (closest future active opportunity)
    const nextDistribution = await Opportunity.findOne({
      status: 'Active',
      date: { $gte: new Date() } // Future or today events
    }).sort({ date: 1, time: 1 }); // Closest first

    // Calculate missing documents (Expected: ID, Proof of Residence, Proof of Income = 3 documents)
    const uploadedDocumentTypes = new Set(
      profile.documents
        .filter(doc => doc.status === 'pending' || doc.status === 'approved')
        .map(doc => doc.documentType)
    );
    const requiredDocumentTypes = ['ID', 'Proof of Residence', 'Proof of Income'];
    const missingCount = requiredDocumentTypes.filter(type => !uploadedDocumentTypes.has(type)).length;

    const dashboardData = {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      intakeStatus: profile.intakeStatus,
      communityUpdates: updates,
      nextDistribution: nextDistribution ? {
        id: nextDistribution._id,
        title: nextDistribution.title,
        date: nextDistribution.date,
        time: nextDistribution.time,
        endTime: nextDistribution.endTime,
        location: nextDistribution.location,
        specificLocation: nextDistribution.specificLocation
      } : null,
      documentsStatus: {
        missingCount: missingCount
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Submit/Update Intake Progress
 * @route   PATCH /api/participant/intake-step
 * @access  Private (Participant)
 */
exports.submitIntakeStep = async (req, res) => {
  try {
    const { step, data } = req.body; // step (1-6), data (optional profile updates)

    if (!step || step < 1 || step > 6) {
      return res.status(400).json({ success: false, message: 'Invalid intake step (must be 1-6)' });
    }

    const percentage = Math.round((step / 6) * 100);
    
    // Prepare update object
    const update = {
      'intakeStatus.currentStep': step,
      'intakeStatus.percentage': percentage,
      'intakeStatus.status': step === 6 ? 'Pending Review' : 'Action Required'
    };

    // If data is provided (e.g., from a "Next Step" button that saves), merge it
    if (data) {
      if (data.interests) update.interests = data.interests;
      if (data.housingStatus) update.housingStatus = data.housingStatus;
      if (data.address) update.address = data.address;
      if (data.unhousedDetails) update.unhousedDetails = data.unhousedDetails;
      if (data.householdSize !== undefined) update.householdSize = data.householdSize;
      if (data.dietaryRestrictions) update.dietaryRestrictions = data.dietaryRestrictions;
      if (data.isVeteran !== undefined) update.isVeteran = data.isVeteran;
      if (data.hasDisability !== undefined) update.hasDisability = data.hasDisability;
      if (data.monthlyIncome !== undefined) update.monthlyIncome = data.monthlyIncome;
      if (data.citizenStatus) update.citizenStatus = data.citizenStatus;
      if (data.assistancePrograms) update.assistancePrograms = data.assistancePrograms;
      if (data.consentToInformationUse !== undefined) update.consentToInformationUse = data.consentToInformationUse;
    }

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Intake step ${step} updated`,
      data: profile.intakeStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Upload Participant Document (ID/Proof)
 * @route   POST /api/participant/upload-document
 * @access  Private (Participant)
 */
exports.uploadDocument = async (req, res) => {
  try {
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    if (!['ID', 'Proof of Residence', 'Proof of Income'].includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const fileUrl = req.file.path;

    const profile = await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { 
        $push: { 
          documents: { 
            documentType, 
            fileUrl, 
            status: 'pending' 
          } 
        } 
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: `${documentType} uploaded successfully`,
      data: profile.documents[profile.documents.length - 1]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Send email verification code (OTP)
 * @route   POST /api/participant/send-verification-code
 * @access  Private (Participant)
 */
exports.sendVerificationCode = async (req, res) => {
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in profile (selected: false by default in model)
    await ParticipantProfile.findOneAndUpdate(
      { userId: req.user._id },
      { emailVerificationCode: otp },
      { upsert: true }
    );

    // Send actual email
    try {
      const sendEmail = require('../utils/sendEmail');
      await sendEmail({
        email: req.user.email,
        subject: 'Email Verification Code',
        message: `Your verification code is: ${otp}`,
        html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
      });
    } catch (err) {
      console.error('Email could not be sent', err);
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Verify email OTP code
 * @route   POST /api/participant/verify-code
 * @access  Private (Participant)
 */
exports.verifyCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide the verification code' });
    }

    const profile = await ParticipantProfile.findOne({ userId: req.user._id }).select('+emailVerificationCode');

    if (!profile || profile.emailVerificationCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    // Mark as verified and clear code
    profile.isEmailVerified = true;
    profile.emailVerificationCode = undefined;
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get List of Pantries / Opportunities with Search
 * @route   GET /api/participant/pantries
 * @access  Private (Participant)
 */
exports.getPantries = async (req, res) => {
  try {
    const { search, filter = 'today' } = req.query;
    const now = new Date();
    let startDate, endDate;

    // Helper functions for date boundaries
    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    if (filter === 'tomorrow') {
      startDate = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      endDate = endOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    } else if (filter === 'this_week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday));
      endDate = endOfDay(new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000));
    } else {
      // today
      startDate = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      endDate = endOfDay(now);
    }

    let query = { 
      status: 'Active',
      date: { $gte: startDate, $lte: endDate }
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const opportunities = await Opportunity.find(query).sort({ date: 1, time: 1 });
    const currentUserId = req.user._id;

    // Helper to parse time
    const parseTime = (timeStr) => {
      if (!timeStr) return null;
      const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3] ? match[3].toUpperCase() : null;
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return { hours, minutes };
    };

    const formattedPantries = opportunities.map(opp => {
      const oppObj = opp.toObject();
      let isOpenNow = false;
      let closesInMinutes = null;
      
      if (oppObj.date && oppObj.time && oppObj.endTime) {
        const slotDate = new Date(oppObj.date);
        const startTimeParsed = parseTime(oppObj.time);
        const endTimeParsed = parseTime(oppObj.endTime);

        if (startTimeParsed && endTimeParsed) {
          const openTime = new Date(slotDate);
          openTime.setHours(startTimeParsed.hours, startTimeParsed.minutes, 0, 0);
          let closeTime = new Date(slotDate);
          closeTime.setHours(endTimeParsed.hours, endTimeParsed.minutes, 0, 0);
          if (closeTime < openTime) closeTime.setDate(closeTime.getDate() + 1);

          if (now >= openTime && now <= closeTime) {
            isOpenNow = true;
            closesInMinutes = Math.floor((closeTime - now) / (1000 * 60));
          }
        }
      }

      // Calculate occupancy
      const attendeesCount = oppObj.attendees ? oppObj.attendees.length : 0;
      const remainingSpots = Math.max(0, (oppObj.requiredVolunteers || 0) - attendeesCount);

      return {
        id: opp._id,
        title: opp.title,
        location: opp.location,
        specificLocation: opp.specificLocation,
        category: opp.category,
        imageurl: opp.imageurl,
        isOpenNow,
        closesInMinutes,
        totalAttendees: attendeesCount,
        remainingSpots,
        isRegistered: opp.attendees.some(id => id.toString() === currentUserId.toString()),
        distance: "0.5 Min", // Mocked for UI
        date: opp.date,
        time: opp.time,
        endTime: opp.endTime
      };
    });

    res.status(200).json({
      success: true,
      count: formattedPantries.length,
      data: formattedPantries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
