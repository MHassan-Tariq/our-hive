const VolunteerProfile = require('../models/VolunteerProfile');
const Opportunity = require('../models/Opportunity');
const ActivityLog = require('../models/ActivityLog');
const VolunteerLog = require('../models/VolunteerLog');
const Notification = require('../models/Notification');

/**
 * @desc    Save / update a volunteer's profile
 * @route   POST /api/volunteer/profile
 * @access  Private (volunteer)
 */

/**
 * @desc    Get all AVAILABLE opportunities (active + not full)
 * @route   GET /api/opportunities/available
 * @access  Private (volunteer)
 */
const getAvailableOpportunities = async (req, res) => {
  try {
    const { search, location, category } = req.query;

    const query = { status: 'active' };

    // 1. Keyword search (title + description)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // 2. Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // 3. Category filter
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const opportunities = await Opportunity.aggregate([
      {
        $match: query,
      },
      {
        $addFields: {
          spotsLeft: { $subtract: ['$requiredVolunteers', { $size: '$attendees' }] },
          attendeeCount: { $size: '$attendees' },
        },
      },
      {
        $match: { spotsLeft: { $gt: 0 } },
      },
      {
        $sort: { date: 1, createdAt: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Join an opportunity (claim a volunteer spot)
 * @route   POST /api/opportunities/:id/join
 * @access  Private (volunteer)
 */
const joinOpportunity = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    // 1. Check opportunity exists and is active
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found.',
      });
    }
    if (opportunity.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `This opportunity is no longer active (status: ${opportunity.status}).`,
      });
    }

    const volunteerId = req.user._id;

    // 2. Check if the volunteer has already joined
    const alreadyJoined = opportunity.attendees.some(
      (id) => id.toString() === volunteerId.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this opportunity.',
      });
    }

    // 3. Check capacity
    if (opportunity.attendees.length >= opportunity.requiredVolunteers) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity is full.',
      });
    }

    // 4. Add volunteer to opportunity attendees + update volunteer profile
    opportunity.attendees.push(volunteerId);
    await opportunity.save();

    await VolunteerProfile.findOneAndUpdate(
      { userId: volunteerId },
      { $addToSet: { joinedOpportunities: opportunity._id } },
      { upsert: true, new: true }
    );

    // Activity Log for Partner
    await ActivityLog.create({
      userId: opportunity.partnerId,
      type: 'New Volunteer Interest',
      content: `A community member signed up for "${opportunity.title}".`,
      relatedId: opportunity._id,
      relatedModel: 'Opportunity',
    });

    res.status(200).json({
      success: true,
      message: `You have successfully joined "${opportunity.title}".`,
      data: {
        opportunityId: opportunity._id,
        title: opportunity.title,
        date: opportunity.date,
        time: opportunity.time,
        endTime: opportunity.endTime,
        location: opportunity.location,
        spotsLeft: opportunity.requiredVolunteers - opportunity.attendees.length,
        attendeeCount: opportunity.attendees.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all opportunities the logged-in volunteer has joined
 * @route   GET /api/volunteer/my-tasks
 * @access  Private (volunteer)
 */
const getMyTasks = async (req, res) => {
  try {
    const profile = await VolunteerProfile.findOne({
      userId: req.user._id,
    }).populate({
      path: 'joinedOpportunities',
      select: 'title description location date category requiredVolunteers status attendees partnerId',
      populate: {
        path: 'partnerId',
        select: 'name email',
      },
    });

    if (!profile) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'No volunteer profile found. Join an opportunity to get started.',
      });
    }

    res.status(200).json({
      success: true,
      count: profile.joinedOpportunities.length,
      data: profile.joinedOpportunities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Log volunteer hours
 * @route   POST /api/volunteer/log-hours
 * @access  Private (volunteer)
 */
const logHours = async (req, res) => {
  try {
    const { date, startTime, endTime, category, notes, hours: manualHours } = req.body;

    let totalHours = manualHours;

    // If start/end times provided, calculate duration (simple version)
    if (!totalHours && startTime && endTime) {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      totalHours = (end - start) / (1000 * 60 * 60);
      if (totalHours < 0) totalHours += 24; // Handle overnight if necessary
    }

    if (!totalHours || totalHours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid hours or start/end times.',
      });
    }

    // 1. Create the structured log
    await VolunteerLog.create({
      userId: req.user._id,
      date: date || new Date(),
      startTime,
      endTime,
      category,
      notes,
      hoursLogged: totalHours,
    });

    // 2. Update the profile totals
    let profile = await VolunteerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new VolunteerProfile({ userId: req.user._id });
    }

    profile.totalHours += totalHours;
    profile.hoursThisYear += totalHours;

    // Award badges
    if (profile.totalHours >= 15) {
      const hasBadge = profile.badges.some((b) => b.name === 'Master of Design');
      if (!hasBadge) {
        profile.badges.push({
          name: 'Master of Design',
          level: 'Expert Level',
          badgeId: `#BDG-${Math.floor(1000 + Math.random() * 9000)}`,
          hoursRequired: 15,
          earnedAt: new Date(),
        });
        profile.nextBadgeGoal = 25;
      }
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Hours logged successfully.',
      data: {
        totalHours: profile.totalHours,
        hoursThisYear: profile.hoursThisYear,
        logged: totalHours
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get history of logged hours
 * @route   GET /api/volunteer/logs
 * @access  Private (volunteer)
 */
const getLogHistory = async (req, res) => {
  try {
    const logs = await VolunteerLog.find({ userId: req.user._id }).sort({ date: -1 });
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get details for a specific badge
 * @route   GET /api/volunteer/badges/:badgeId
 * @access  Private (volunteer)
 */
const getBadgeDetails = async (req, res) => {
  try {
    const profile = await VolunteerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const badge = profile.badges.id(req.params.badgeId) || profile.badges.find(b => b.badgeId === req.params.badgeId);
    
    if (!badge) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }

    res.status(200).json({
      success: true,
      data: badge,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const saveProfile = async (req, res) => {
  try {
    let {
      fullName,
      phone,
      skills,
      availability,
      agreedToHandbook,
      profilePictureUrl,
      location,
      backgroundCheckStatus,
    } = req.body;
    // Handle stringified skills
    if (typeof skills === 'string') {
      try {
        // Try parsing JSON or split by comma
        skills = skills.startsWith('[') ? JSON.parse(skills) : skills.split(',').map(s => s.trim());
      } catch (e) {
        skills = skills.split(',').map(s => s.trim());
      }
    }
    // Handle stringified availability from multipart/form-data
    if (typeof availability === 'string') {
      try {
        availability = JSON.parse(availability);
      } catch (e) {
        console.error("Error parsing availability JSON:", e);
      }
    }

    let profile = await VolunteerProfile.findOne({ userId: req.user._id });

    // Handle uploaded files if any
    let governmentIdUrl = req.body.governmentIdUrl;
    let drivingLicenseUrl = req.body.drivingLicenseUrl;

    if (req.files) {
      if (req.files.governmentId) {
        governmentIdUrl = req.files.governmentId[0].path;
      }
      if (req.files.drivingLicense) {
        drivingLicenseUrl = req.files.drivingLicense[0].path;
      }
    }

    if (profile) {
      // Update existing profile
      profile.fullName = fullName || profile.fullName;
      profile.phone = phone || profile.phone;
      profile.skills = skills || profile.skills;
      profile.availability = availability || profile.availability;
      profile.governmentIdUrl = governmentIdUrl || profile.governmentIdUrl;
      profile.drivingLicenseUrl = drivingLicenseUrl || profile.drivingLicenseUrl;
      profile.agreedToHandbook = agreedToHandbook !== undefined ? agreedToHandbook : profile.agreedToHandbook;
      profile.profilePictureUrl = profilePictureUrl || profile.profilePictureUrl;
      profile.location = location || profile.location;
      profile.backgroundCheckStatus = backgroundCheckStatus || profile.backgroundCheckStatus;
      await profile.save();
    } else {
      // Create new profile
      profile = await VolunteerProfile.create({
        userId: req.user._id,
        fullName,
        phone,
        skills,
        availability,
        governmentIdUrl,
        drivingLicenseUrl,
        agreedToHandbook,
        profilePictureUrl,
        location,
        backgroundCheckStatus,
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get volunteer profile
 * @route   GET /api/volunteer/profile
 * @access  Private (volunteer)
 */
const getProfile = async (req, res) => {
  try {
    const profile = await VolunteerProfile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Add email and other user info
    const profileData = profile.toObject();
    profileData.email = req.user.email;
    profileData.volunteerSince = req.user.createdAt;
    profileData.mailingAddress = req.user.mailingAddress || profile.mailingAddress;
    profileData.phone = req.user.phone || profile.phone;
    profileData.firstName = req.user.firstName;
    profileData.lastName = req.user.lastName;

    res.status(200).json({ success: true, data: profileData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/volunteer/dashboard
 * @access  Private (volunteer)
 */
const getDashboardStats = async (req, res) => {
  try {
    const profile = await VolunteerProfile.findOne({ userId: req.user._id }).populate({
      path: 'joinedOpportunities',
      match: { status: 'active' },
      select: 'title date time endTime location',
    });

    if (!profile) {
      return res.status(200).json({
        success: true,
        data: {
          hoursThisYear: 0,
          totalHours: 0,
          totalDeliveries: 0,
          totalImpact: "0 lbs",
          nextBadgeGoal: 10,
          upcomingShifts: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        fullName: profile.fullName || `${req.user.firstName} ${req.user.lastName}`,
        hoursThisYear: profile.hoursThisYear || 0,
        totalHours: profile.totalHours || 0,
        totalDeliveries: profile.totalDeliveries,
        totalImpact: profile.totalImpact,
        nextBadgeGoal: profile.nextBadgeGoal || 10,
        badges: profile.badges,
        upcomingShifts: profile.joinedOpportunities || [],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  saveProfile,
  getProfile,
  getMyTasks,
  logHours,
  getLogHistory,
  getBadgeDetails,
  getDashboardStats,
  getAvailableOpportunities,
  joinOpportunity,
};
