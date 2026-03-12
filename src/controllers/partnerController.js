const PartnerProfile = require('../models/PartnerProfile');
const Opportunity = require('../models/Opportunity');
const InKindDonation = require('../models/InKindDonation');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const mongoose = require('mongoose'); // Ensure mongoose is imported for ObjectId validation
const { notifyAdmins } = require('../utils/notificationService');

/**
 * @desc    Submit or update partner onboarding profile
 * @route   POST /api/partners/profile
 * @access  Private (partner)
 */
const submitProfile = async (req, res) => {
  try {
    let { firstName, lastName, fullName, orgName, orgType, address, website, intendedRoles, agreements } =
      req.body;

    // Handle fullName field - split into firstName and lastName
    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.trim().split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || 'Partner';
    }

    // Handle file upload
    let organizationLogoUrl = req.body.organizationLogoUrl;
    if (req.file) {
      organizationLogoUrl = req.file.path;
    }

    // Handle stringified fields from multipart form
    if (typeof intendedRoles === 'string') {
      try {
        intendedRoles = JSON.parse(intendedRoles);
      } catch (e) {
        intendedRoles = intendedRoles.split(',').map(r => r.trim());
      }
    }
    if (typeof agreements === 'string') {
      try {
        agreements = JSON.parse(agreements);
      } catch (e) { }
    }

    // Update user profile if name fields are provided
    let name;
    if (fullName) {
      name = fullName;
    } else if (firstName || lastName) {
      // combine whatever we have
      name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    if (firstName || lastName) {
      const userUpdateData = {};
      if (firstName) userUpdateData.firstName = firstName;
      if (lastName) userUpdateData.lastName = lastName;

      await User.findByIdAndUpdate(
        req.user._id,
        userUpdateData,
        { new: true, runValidators: true }
      );
    }

    // Upsert: create if not exists, update if it does
    const profile = await PartnerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        name,
        orgName,
        orgType,
        address,
        website,
        organizationLogoUrl,
        intendedRoles,
        agreements,
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Activity Log
    await ActivityLog.create({
      userId: req.user._id,
      type: 'Profile Updated',
      content: 'You updated your organization’s mission statement and contact info.',
      relatedId: profile._id,
      relatedModel: 'PartnerProfile',
    });

    res.status(200).json({
      success: true,
      message: 'Partner profile submitted successfully. Pending admin review.',
      data: profile,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get logged-in partner's own profile
 * @route   GET /api/partners/my-profile
 * @access  Private (partner)
 */
const getMyProfile = async (req, res) => {
  try {
    // Fetch partner profile and populate user info
    const profile = await PartnerProfile.findOne({
      userId: req.user._id,
    }).populate('userId', 'firstName lastName email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'No partner profile found. Please complete your onboarding.',
      });
    }

    // compute fullName for easier consumption on client
    if (profile.userId) {
      const { firstName = '', lastName = '' } = profile.userId;
      profile.userId.fullName = `${firstName} ${lastName}`.trim();
      // if name not stored, set from user data
      if (!profile.name) {
        profile.name = profile.userId.fullName;
      }
    }
    // Ensure partnerId is an ObjectId
    const partnerId =
      req.user._id instanceof mongoose.Types.ObjectId
        ? req.user._id
        : new mongoose.Types.ObjectId(req.user._id);

    // Total events and pending events
    const totalEvents = await Opportunity.countDocuments({ partnerId });
    const pendingEvents = await Opportunity.countDocuments({
      partnerId,
      status: 'Pending',
    });

    // Sum of attendees across all partner events
    const volunteersAgg = await Opportunity.aggregate([
      { $match: { partnerId } },
      {
        $project: {
          attendeesCount: { $size: { $ifNull: ['$attendees', []] } },
        },
      },
      { $group: { _id: null, total: { $sum: '$attendeesCount' } } },
    ]);

    const totalVolunteers =
      (volunteersAgg[0] && volunteersAgg[0].total) || 0;

    // Count total picked up/delivered in-kind donations
    const totalPickups = await InKindDonation.countDocuments({
      recipientId: partnerId,
      status: { $in: ['PickedUp', 'Delivered'] }
    });

    // Respond with profile and stats
    res.status(200).json({
      success: true,
      data: {
        profile,
        stats: {
          totalEvents,
          pendingEvents,
          totalVolunteers,
          totalPickups,
        },
      },
    });
  } catch (err) {
    console.error('getMyProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


/**
 * @desc    Update logged-in partner's profile
 * @route   PATCH /api/partners/my-profile
 * @access  Private (partner)
 */
const updateProfile = async (req, res) => {
  try {
    let { firstName, lastName, fullName, orgName, orgType, orgAddress, website, intendedRoles, agreements } =
      req.body;
    // Handle fullName field - split into firstName and lastName
    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.trim().split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || 'Partner';
    }

    // determine combined name to store
    let name;
    if (fullName) {
      name = fullName;
    } else if (firstName || lastName) {
      name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    // Find existing partner profile
    let profile = await PartnerProfile.findOne({ userId: req.user._id });

    // Build update object for partner profile with only provided fields
    const updateData = {};
    if (name || fullName) {
      updateData.name = name || fullName;
    } if (orgName !== undefined) updateData.orgName = orgName;
    if (orgType !== undefined) updateData.orgType = orgType;
    // support both address fields for compatibility
    if (orgAddress !== undefined) updateData.address = orgAddress;
    // if (address !== undefined) updateData.address = address;
    if (website !== undefined) updateData.website = website;

    // if no profile exists yet, we'll create it later after applying updates

    // Handle intendedRoles - parse if it's a string
    if (intendedRoles !== undefined) {
      if (typeof intendedRoles === 'string') {
        try {
          updateData.intendedRoles = JSON.parse(intendedRoles);
        } catch (e) {
          updateData.intendedRoles = intendedRoles.split(',').map(r => r.trim());
        }
      } else {
        updateData.intendedRoles = intendedRoles;
      }
    }

    // Handle agreements - parse if it's a string
    if (agreements !== undefined) {
      if (typeof agreements === 'string') {
        try {
          updateData.agreements = JSON.parse(agreements);
        } catch (e) {
          updateData.agreements = agreements;
        }
      } else {
        updateData.agreements = agreements;
      }
    }

    // Handle file upload
    if (req.file) {
      updateData.organizationLogoUrl = req.file.path;
    }

    // Update user profile if name fields are provided
    if (firstName || lastName) {
      const userUpdateData = {};
      if (firstName) userUpdateData.firstName = firstName;
      if (lastName) userUpdateData.lastName = lastName;

      await User.findByIdAndUpdate(
        req.user._id,
        userUpdateData,
        { new: true, runValidators: true }
      );
    }

    // Update or create partner profile
    let updatedProfile;
    if (!profile) {
      // creating new profile (userId is required)
      updatedProfile = await PartnerProfile.create({
        userId: req.user._id,
        ...updateData,
      });
    } else {
      updatedProfile = await PartnerProfile.findOneAndUpdate(
        { userId: req.user._id },
        updateData,
        { new: true, runValidators: true }
      );
    }

    // populate user info and compute fullName for response
    updatedProfile = await PartnerProfile.findById(updatedProfile._id).populate('userId', 'firstName lastName email');
    if (updatedProfile.userId) {
      const { firstName = '', lastName = '' } = updatedProfile.userId;
      updatedProfile.userId.fullName = `${firstName} ${lastName}`.trim();
    }

    // Activity Log
    await ActivityLog.create({
      userId: req.user._id,
      type: 'Profile Updated',
      content: 'You updated your organization profile.',
      relatedId: updatedProfile._id,
      relatedModel: 'PartnerProfile',
    });

    res.status(200).json({
      success: true,
      message: 'Partner profile updated successfully.',
      data: updatedProfile,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages });
    }
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


/**
 * @desc    Get partner dashboard overview
 * @route   GET /api/partners/dashboard
 * @access  Private (partner)
 */
const getDashboardData = async (req, res) => {
  try {
    const partnerId = req.user._id;

    // 1. Get Partner Profile
    const profile = await PartnerProfile.findOne({ userId: partnerId });

    // 2. Get Recent Activities
    const activities = await ActivityLog.find({ userId: partnerId })
      .sort({ createdAt: -1 })
      .limit(10);

    // 3. Get Assigned Pickups (where this partner is the recipient)
    const pendingPickups = await InKindDonation.find({
      recipientId: partnerId,
      status: { $ne: 'delivered' },
    }).populate('donorId', 'name');

    // 4. Get User Profile (for greeting firstName)
    const user = await User.findById(partnerId).select('firstName lastName email');

    // 5. Get Total Pickups count
    const totalPickups = await InKindDonation.countDocuments({
      recipientId: partnerId,
      status: { $in: ['PickedUp', 'Delivered'] }
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        profile,
        activities,
        pendingPickups,
        counts: {
          pendingPickups: pendingPickups.length,
          totalPickups,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Create a new volunteer opportunity or event (approved partners only)
 * @route   POST /api/opportunities
 * @access  Private (partner)
 */
const createOpportunity = async (req, res) => {
  try {
    const profile = await PartnerProfile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(403).json({
        success: false,
        message:
          'No partner profile found. Please complete your onboarding first.',
      });
    }

    if (profile.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your organization is still pending admin approval.',
      });
    }

    const {
      title,
      description,
      location,
      specificLocation,
      whatToBring: rawWhatToBring,
      requirements: rawRequirements,
      date,
      time,
      endTime,
      category,
      requiredVolunteers,
      type,
      impactStatement,
      physicalRequirements,
      dressCode,
      orientation,
    } = req.body;

    // Normalize arrays
    let whatToBring = rawWhatToBring;
    if (typeof whatToBring === 'string') {
      try {
        whatToBring = JSON.parse(whatToBring);
      } catch (e) {
        whatToBring = whatToBring.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(whatToBring)) {
      whatToBring = whatToBring.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    }

    let requirements = rawRequirements;
    if (typeof requirements === 'string') {
      try {
        requirements = JSON.parse(requirements);
      } catch (e) {
        requirements = requirements.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(requirements)) {
      requirements = requirements.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    }

    // Handle file upload
    let imageurl = req.body.imageurl || null;
    if (req.file) {
      imageurl = req.file.path;
    }

    const opportunity = await Opportunity.create({
      partnerId: req.user._id,
      title,
      description,
      location,
      specificLocation,
      whatToBring,
      requirements,
      date,
      time,
      endTime,
      category,
      requiredVolunteers,
      type: type || 'opportunity',
      imageurl,
      impactStatement,
      physicalRequirements,
      dressCode,
      orientation,
      status: 'Pending',
    });

    // Notify Admins
    await notifyAdmins(
      'New Event Submitted',
      `Partner "${profile.orgName}" has submitted a new event "${title}" for approval.`
    );

    res.status(201).json({
      success: true,
      message: 'Event created and submitted for approval.',
      data: opportunity,
    });

  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages });
    }

    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
/**
 * @desc    Update an existing volunteer opportunity
 * @route   PUT /api/opportunities/:id
 * @access  Private (partner)
 */
const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.user._id;

    let opportunity = await Opportunity.findOne({ _id: id, partnerId });

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found or you do not own this opportunity.',
      });
    }
    const {
      title,
      description,
      location,
      date,
      time,
      endTime,
      category,
      requiredVolunteers,
      type,
      impactStatement,
      physicalRequirements,
      dressCode,
      orientation,
      specificLocation,
      whatToBring,
      requirements,
    } = req.body;

    // Handle stringified fields from multipart form
    let parsedWhatToBring = whatToBring;
    if (typeof whatToBring === 'string') {
      try {
        parsedWhatToBring = JSON.parse(whatToBring);
      } catch (e) {
        parsedWhatToBring = whatToBring.split(',').map(item => item.trim());
      }
    }
    if (Array.isArray(parsedWhatToBring)) {
      parsedWhatToBring = parsedWhatToBring.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    }

    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        parsedRequirements = requirements.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(parsedRequirements)) {
      parsedRequirements = parsedRequirements.reduce((acc, curr) => {
        if (typeof curr === 'string') {
          return acc.concat(curr.split(',').map(item => item.trim()).filter(Boolean));
        }
        return acc.concat(curr);
      }, []);
    }

    // Handle file upload
    let imageurl = opportunity.imageurl;
    if (req.file) {
      imageurl = req.file.path;
    }

    // Check if any fields that require re-approval are being updated
    const fieldsRequiringReapproval = [
      'title',
      'description',
      'location',
      'specificLocation',
      'whatToBring',
      'requirements',
      'date',
      'time',
      'endTime',
      'category',
      'requiredVolunteers',
      'type',
      'imageurl',
      'impactStatement',
      'physicalRequirements',
      'dressCode',
      'orientation',
    ];

    let needsReapproval = false;
    const updateFields = {};

    for (const field of fieldsRequiringReapproval) {
      let newValue;
      if (field === 'imageurl') {
        newValue = imageurl;
      } else if (field === 'whatToBring') {
        newValue = parsedWhatToBring;
      } else if (field === 'requirements') {
        newValue = parsedRequirements;
      } else {
        newValue = req.body[field];
      }

      if (newValue !== undefined && JSON.stringify(newValue) !== JSON.stringify(opportunity[field])) {
        needsReapproval = true;
      }
    }

    // Update fields
    opportunity.title = title || opportunity.title;
    opportunity.description = description || opportunity.description;
    opportunity.location = location || opportunity.location;
    opportunity.specificLocation = specificLocation || opportunity.specificLocation;
    opportunity.whatToBring = parsedWhatToBring || opportunity.whatToBring;
    opportunity.requirements = parsedRequirements || opportunity.requirements;
    opportunity.date = date || opportunity.date;
    opportunity.time = time || opportunity.time;
    opportunity.endTime = endTime || opportunity.endTime;
    opportunity.category = category || opportunity.category;
    opportunity.requiredVolunteers = requiredVolunteers || opportunity.requiredVolunteers;
    opportunity.type = type || opportunity.type;
    opportunity.imageurl = imageurl || opportunity.imageurl;
    opportunity.impactStatement = impactStatement || opportunity.impactStatement;
    opportunity.physicalRequirements = physicalRequirements || opportunity.physicalRequirements;
    opportunity.dressCode = dressCode || opportunity.dressCode;
    opportunity.orientation = orientation || opportunity.orientation;

    // If significant fields are updated, set status back to pending for review
    if (needsReapproval && opportunity.status !== 'Pending') {
      opportunity.status = 'Pending';
      opportunity.adminNotes = 'Opportunity updated by partner, pending re-approval.';
    }

    await opportunity.save();

    // Notify Admins if it went back to Pending
    if (needsReapproval && opportunity.status === 'Pending') {
      const profile = await PartnerProfile.findOne({ userId: req.user._id });
      await notifyAdmins(
        'Event Update Submitted',
        `Partner "${profile.orgName}" has updated event "${opportunity.title}". It is now pending re-approval.`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Opportunity updated successfully.',
      data: opportunity,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all opportunities created by the logged-in partner
 * @route   GET /api/opportunities/partner
 * @access  Private (partner)
 */


const getMyOpportunities = async (req, res) => {
  try {
    const partnerId = req.user._id;
    console.log('Fetching opportunities for partner ID:', partnerId);

    const { status, search } = req.query;

    // Start with partner filter
    const filter = { partnerId };

    // ✅ Status filter
    if (status && status.toLowerCase() !== 'all') {
      const statusMap = {
        pending: 'Pending',
        rejected: 'Rejected',
        approved: ['Active', 'Confirmed'], // multiple statuses
      };

      const mappedStatus = statusMap[status.toLowerCase()];
      if (mappedStatus) {
        if (Array.isArray(mappedStatus)) {
          filter.status = { $in: mappedStatus }; // for approved
        } else {
          filter.status = mappedStatus; // for single statuses
        }
      }
    }

    // ✅ Search by title (case-insensitive)
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const opportunities = await Opportunity.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities,
    });

  } catch (err) {
    console.error('Error fetching partner opportunities:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  submitProfile,
  getMyProfile,
  updateProfile,
  getDashboardData,
  createOpportunity,
  updateOpportunity,
  getMyOpportunities,
};
