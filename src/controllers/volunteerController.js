const VolunteerProfile = require('../models/VolunteerProfile');
const Opportunity = require('../models/Opportunity');
const ActivityLog = require('../models/ActivityLog');

/**
 * @desc    Save / update a volunteer's profile
 * @route   POST /api/volunteer/profile
 * @access  Private (volunteer)
 */
const saveProfile = async (req, res) => {
  try {
    const { fullName, phone, skills, availability } = req.body;

    const profile = await VolunteerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, fullName, phone, skills, availability },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Volunteer profile saved successfully.',
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
 * @desc    Get all AVAILABLE opportunities (active + not full)
 * @route   GET /api/opportunities/available
 * @access  Private (volunteer)
 */
const getAvailableOpportunities = async (req, res) => {
  try {
    // Use aggregation to compare attendees.length against requiredVolunteers
    // This way the database does the filtering — not the app layer
    const opportunities = await Opportunity.aggregate([
      {
        $match: { status: 'active' },
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

module.exports = {
  saveProfile,
  getAvailableOpportunities,
  joinOpportunity,
  getMyTasks,
};
