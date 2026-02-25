const PartnerProfile = require('../models/PartnerProfile');
const Opportunity = require('../models/Opportunity');
const InKindDonation = require('../models/InKindDonation');
const ActivityLog = require('../models/ActivityLog');

/**
 * @desc    Submit or update partner onboarding profile
 * @route   POST /api/partners/profile
 * @access  Private (partner)
 */
const submitProfile = async (req, res) => {
  try {
    let { orgName, orgType, address, website, intendedRoles, agreements } =
      req.body;

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
      } catch (e) {}
    }

    // Upsert: create if not exists, update if it does
    const profile = await PartnerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
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
    const profile = await PartnerProfile.findOne({
      userId: req.user._id,
    }).populate('userId', 'firstName lastName email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'No partner profile found. Please complete your onboarding.',
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
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

    res.status(200).json({
      success: true,
      data: {
        profile,
        activities,
        pendingPickups,
        counts: {
          pendingPickups: pendingPickups.length,
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
    // ── Business Logic: only approved partners can post opportunities ──
    const profile = await PartnerProfile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(403).json({
        success: false,
        message:
          'No partner profile found. Please complete your onboarding first.',
      });
    }

    if (profile.status !== 'approved') {
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
      whatToBring,
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

    // Handle stringified fields from multipart form
    if (typeof whatToBring === 'string') {
      try {
        whatToBring = JSON.parse(whatToBring);
      } catch (e) {
        whatToBring = whatToBring.split(',').map(item => item.trim());
      }
    }

    // Handle file upload
    let flyerUrl = req.body.flyerUrl;
    if (req.file) {
      flyerUrl = req.file.path;
    }

    const opportunity = await Opportunity.create({
      partnerId: req.user._id,
      title,
      description,
      location,
      specificLocation,
      whatToBring,
      date,
      time,
      endTime,
      category,
      requiredVolunteers,
      type: type || 'opportunity',
      flyerUrl,
      impactStatement,
      physicalRequirements,
      dressCode,
      orientation,
      status: 'pending', // Explicitly set to pending for review
    });

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

    // Handle file upload
    let flyerUrl = opportunity.flyerUrl;
    if (req.file) {
      flyerUrl = req.file.path;
    }

    // Check if any fields that require re-approval are being updated
    const fieldsRequiringReapproval = [
      'title',
      'description',
      'location',
      'specificLocation',
      'whatToBring',
      'date',
      'time',
      'endTime',
      'category',
      'requiredVolunteers',
      'type',
      'flyerUrl',
      'impactStatement',
      'physicalRequirements',
      'dressCode',
      'orientation',
    ];

    let needsReapproval = false;
    const updateFields = {};

    for (const field of fieldsRequiringReapproval) {
      let newValue;
      if (field === 'flyerUrl') {
        newValue = flyerUrl;
      } else if (field === 'whatToBring') {
        newValue = parsedWhatToBring;
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
    opportunity.date = date || opportunity.date;
    opportunity.time = time || opportunity.time;
    opportunity.endTime = endTime || opportunity.endTime;
    opportunity.category = category || opportunity.category;
    opportunity.requiredVolunteers = requiredVolunteers || opportunity.requiredVolunteers;
    opportunity.type = type || opportunity.type;
    opportunity.flyerUrl = flyerUrl || opportunity.flyerUrl;
    opportunity.impactStatement = impactStatement || opportunity.impactStatement;
    opportunity.physicalRequirements = physicalRequirements || opportunity.physicalRequirements;
    opportunity.dressCode = dressCode || opportunity.dressCode;
    opportunity.orientation = orientation || opportunity.orientation;

    // If significant fields are updated, set status back to pending for review
    if (needsReapproval && opportunity.status !== 'pending') {
      opportunity.status = 'pending';
      opportunity.adminNotes = 'Opportunity updated by partner, pending re-approval.';
    }

    await opportunity.save();

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
    const { status, category, search } = req.query;
    const filter = { partnerId };

    if (status) {
      filter.status = status;
    }
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const opportunities = await Opportunity.find(filter).sort({ createdAt: -1 });

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

module.exports = {
  submitProfile,
  getMyProfile,
  getDashboardData,
  createOpportunity,
  updateOpportunity,
  getMyOpportunities,
};
