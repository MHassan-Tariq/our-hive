const VolunteerProfile = require('../models/VolunteerProfile');
const Opportunity = require('../models/Opportunity');
const ActivityLog = require('../models/ActivityLog');
const VolunteerLog = require('../models/VolunteerLog');
const Badge = require('../models/Badge');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs');

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

    const query = { status: 'Active' };

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
    if (opportunity.status !== 'Active') {
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
 * @desc    Get all opportunities the volunteer has claimed with logged hours
 * @route   GET /api/volunteer/claimed-opportunities
 * @access  Private (volunteer)
 */
const getClaimedOpportunities = async (req, res) => {
  try {
    // Get all volunteer logs for this user organized by opportunity
    const logs = await VolunteerLog.find({ userId: req.user._id })
      .populate({
        path: 'opportunityId',
        select: 'title description location date time endTime category requiredVolunteers status partnerId attendees',
        populate: {
          path: 'partnerId',
          select: 'firstName lastName email orgName',
        },
      })
      .sort({ date: -1 });

    // Get the volunteer profile to also include joined opportunities without logs
    const profile = await VolunteerProfile.findOne({
      userId: req.user._id,
    }).populate({
      path: 'joinedOpportunities',
      select: 'title description location date time endTime category requiredVolunteers status partnerId attendees',
      populate: {
        path: 'partnerId',
        select: 'firstName lastName email orgName',
      },
    });

    // Build a map of opportunities with their logged hours
    const opportunityMap = new Map();

    // Add all logs to map
    logs.forEach((log) => {
      if (log.opportunityId) {
        const oppId = log.opportunityId._id.toString();
        if (!opportunityMap.has(oppId)) {
          opportunityMap.set(oppId, {
            ...log.opportunityId.toObject(),
            isLogged: true,
            logs: [],
          });
        }
        opportunityMap.get(oppId).logs.push({
          date: log.date,
          startTime: log.startTime,
          endTime: log.endTime,
          category: log.category,
          notes: log.notes,
          hoursLogged: log.hoursLogged,
          createdAt: log.createdAt,
        });
      }
    });

    // Add joined opportunities not yet logged
    if (profile && profile.joinedOpportunities) {
      profile.joinedOpportunities.forEach((opp) => {
        const oppId = opp._id.toString();
        if (!opportunityMap.has(oppId)) {
          opportunityMap.set(oppId, {
            ...opp.toObject(),
            isLogged: false,
            logs: [],
          });
        }
      });
    }

    const claimedOpportunities = Array.from(opportunityMap.values());

    res.status(200).json({
      success: true,
      count: claimedOpportunities.length,
      data: claimedOpportunities,
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

// Helper function to assign badges based on total hours
const assignBadges = async (profile) => {
  const allBadges = await Badge.find().sort({ timeRequired: 1 });
  let newBadges = [];

  for (const badge of allBadges) {
    // Convert timeRequired to number to handle both string and number types
    const badgeHoursRequired = Number(badge.timeRequired);
    
    if (profile.totalHours >= badgeHoursRequired) {
      const hasBadge = profile.badges.some((b) => b.name === badge.title);
      if (!hasBadge) {
        profile.badges.push({
          name: badge.title,
          level: badge.level,
          badgeId: `#BDG-${Math.floor(1000 + Math.random() * 9000)}`,
          hoursRequired: badgeHoursRequired,
          imageUrl: badge.imageUrl,
          earnedAt: new Date(),
        });
        newBadges.push(badge.title);
      }
    }
  }

  // Update nextBadgeGoal to the next badge's timeRequired
  const nextBadge = allBadges.find(b => Number(b.timeRequired) > profile.totalHours);
  if (nextBadge) {
    profile.nextBadgeGoal = Number(nextBadge.timeRequired);
  } else {
    profile.nextBadgeGoal = profile.totalHours + 10; // Default if no more badges
  }

  return newBadges;
};

const logHours = async (req, res) => {
    try {
      // allow opportunity ID from either route param or body
      const opportunityId = req.params.id || req.body.opportunityId;
const { date, startTime, endTime, category: incomingCategory, notes, hours: manualHours } = req.body;
const category = incomingCategory || 'General Volunteering';
      // if opportunityId is present, validate it and ensure user participated
      let opportunity;
      if (opportunityId) {
        if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid opportunity ID',
          });
        }
        opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) {
          return res.status(404).json({
            success: false,
            message: 'Opportunity not found',
          });
        }
        const userIdStr = req.user._id.toString();
        const isAttendee = (opportunity.attendees || [])
          .some((id) => id.toString() === userIdStr) ||
          (opportunity.checkedInUsers || [])
          .some((id) => id.toString() === userIdStr);
        if (!isAttendee) {
          return res.status(403).json({
            success: false,
            message: 'You must join or check-in before logging hours for this opportunity.',
          });
        }
      }

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
        opportunityId: opportunityId || null,
      });

      // 2. Update the profile totals
      let profile = await VolunteerProfile.findOne({ userId: req.user._id });
      if (!profile) {
        profile = new VolunteerProfile({ userId: req.user._id });
      }

      profile.totalHours += totalHours;
      profile.hoursThisYear += totalHours;

      // Award badges based on total hours
      const newBadges = await assignBadges(profile);

      await profile.save();

      // if we logged hours for an opportunity, record an activity for the organizer
      if (opportunity) {
        await ActivityLog.create({
          userId: opportunity.partnerId,
          type: 'Volunteer Hours Logged',
          content: `${req.user.firstName} logged ${totalHours} hours for "${opportunity.title}".`,
          relatedId: opportunity._id,
          relatedModel: 'Opportunity',
        });
      }

      const responseData = {
        totalHours: profile.totalHours,
        hoursThisYear: profile.hoursThisYear,
        logged: totalHours,
      };
      if (opportunity) {
        responseData.opportunity = {
          _id: opportunity._id,
          title: opportunity.title,
        };
      }

      res.status(200).json({
        success: true,
        message: 'Hours logged successfully.',
        data: responseData,
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
    // `profilePictureUrl` already defined via destructuring above

    if (req.files) {
      if (req.files.governmentId) {
        governmentIdUrl = req.files.governmentId[0].path;
      }
      if (req.files.drivingLicense) {
        drivingLicenseUrl = req.files.drivingLicense[0].path;
      }
      if (req.files.profilePicture) {
        try {
          const localFilePath = req.files.profilePicture[0].path;
          // Upload profile picture to Cloudinary
          const result = await cloudinary.uploader.upload(
            localFilePath,
            {
              folder: 'volunteer-profiles',
              resource_type: 'auto',
              quality: 'auto',
            }
          );
          profilePictureUrl = result.secure_url;
          // Delete local temp file after successful upload
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
          }
        } catch (cloudinaryErr) {
          console.error('Cloudinary upload error:', cloudinaryErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture to cloud storage',
          });
        }
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
        profilePictureUrl,
        agreedToHandbook,
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
    // ensure the avatar field always exists (empty string if none)
    profileData.profilePictureUrl = profileData.profilePictureUrl || '';
    profileData.email = req.user.email;
    profileData.volunteerSince = req.user.createdAt;
    profileData.mailingAddress = req.user.mailingAddress || profile.mailingAddress;
    profileData.phone = req.user.phone || profile.phone;
    profileData.firstName = req.user.firstName;
    profileData.lastName = req.user.lastName;
    // include existing ID document URLs if any
    profileData.governmentIdUrl = profile.governmentIdUrl || '';
    profileData.drivingLicenseUrl = profile.drivingLicenseUrl || '';

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
      match: { status: 'Active' },
      select: 'title date time endTime location',
    });

    if (!profile) {
      return res.status(200).json({
        success: true,
        data: {
          fullName: `${req.user.firstName} ${req.user.lastName}`,
          hoursThisYear: 0,
          totalHours: 0,
          totalDeliveries: 0,
          totalImpact: "0 lbs",
          nextBadgeGoal: 10,
          badges: [],
          upcomingShifts: [],
        },
      });
    }

    // Ensure badges are up to date
    await assignBadges(profile);
    await profile.save();

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

/**
 * @desc    Upload volunteer documents (ID and License)
 * @route   POST /api/volunteer/upload-docs/:userId
 * @access  Private (volunteer)
 */
const uploadVolunteerDocs = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Security check: ensure the logged-in user is only uploading for themselves
    if (req.user._id.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to upload documents for this user.',
      });
    }

    let profile = await VolunteerProfile.findOne({ userId });

    if (!profile) {
      profile = new VolunteerProfile({ userId });
    }

    if (req.files) {
      if (req.files.governmentId) {
        profile.governmentIdUrl = req.files.governmentId[0].path;
      }
      if (req.files.drivingLicense) {
        profile.drivingLicenseUrl = req.files.drivingLicense[0].path;
      }
      await profile.save();
    } else {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded.',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        governmentIdUrl: profile.governmentIdUrl,
        drivingLicenseUrl: profile.drivingLicenseUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Manually reassign badges to a volunteer (useful for retroactive assignment)
 * @route   POST /api/volunteer/reassign-badges
 * @access  Private (volunteer or admin)
 */
const reassignBadges = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    // Verification: user can reassign for themselves or admin can reassign for anyone
    if (req.user._id.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reassign badges for this user.',
      });
    }

    const profile = await VolunteerProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer profile not found',
      });
    }

    // Clear existing badges and reassign from scratch
    const previousBadges = profile.badges.length;
    profile.badges = [];

    // Reassign badges based on current total hours
    const newBadges = await assignBadges(profile);
    await profile.save();

    res.status(200).json({
      success: true,
      message: `Badges reassigned. Previous: ${previousBadges}, Current: ${profile.badges.length}, New badges earned: ${newBadges.join(', ') || 'None'}`,
      data: {
        totalHours: profile.totalHours,
        badges: profile.badges,
        nextBadgeGoal: profile.nextBadgeGoal,
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
  uploadVolunteerDocs,
  getClaimedOpportunities,
  reassignBadges,
};
