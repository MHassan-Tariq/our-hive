const Opportunity = require('../models/Opportunity');
const VolunteerProfile = require('../models/VolunteerProfile');
const ActivityLog = require('../models/ActivityLog');
const PartnerProfile = require('../models/PartnerProfile');
const mongoose = require('mongoose'); 

/**
 * @desc    Get all upcoming active opportunities (Events)
 * @route   GET /api/opportunities/upcoming
 * @access  Private
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const { search, location, category } = req.query;
    const query = { status: 'Active' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const opportunities = await Opportunity.find(query)
      .sort({ date: 1, createdAt: -1 });

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
 * @desc    Join an event as a guest or volunteer
 * @route   POST /api/opportunities/:id/join
 * @access  Private
 */
const joinEvent = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (opportunity.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `This event is no longer active (status: ${opportunity.status}).`,
      });
    }

    const userId = req.user._id;

    // Check if already joined
    const alreadyJoined = opportunity.attendees.some(
      (id) => id.toString() === userId.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered for this event.',
      });
    }

    // Check capacity
    if (opportunity.attendees.length >= opportunity.requiredVolunteers) {
      return res.status(400).json({ success: false, message: 'Event is full.' });
    }

    // Add to attendees
    opportunity.attendees.push(userId);
    await opportunity.save();

    // If user is a volunteer, also update VolunteerProfile for stats/badges
    if (req.user.role === 'volunteer') {
      await VolunteerProfile.findOneAndUpdate(
        { userId },
        { $addToSet: { joinedOpportunities: opportunity._id } },
        { upsert: true }
      );
    }

    // Impact log for the organizer (partner)
    await ActivityLog.create({
      userId: opportunity.partnerId,
      type: 'New Registration',
      content: `${req.user.firstName} joined "${opportunity.title}".`,
      relatedId: opportunity._id,
      relatedModel: 'Opportunity',
    });

    res.status(200).json({
      success: true,
      message: `Successfully joined "${opportunity.title}".`,
      data: opportunity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all events the logged-in user has registered for
 * @route   GET /api/opportunities/my-registered
 * @access  Private
 */
const getMyRegisteredEvents = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({
      attendees: req.user._id,
    }).sort({ date: 1 });

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
 * @desc    Get details for a specific event
 * @route   GET /api/opportunities/:id
 * @access  Private
 */
 
const getEventDetails = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching details for event ID:', id);

    // ✅ 1️⃣ Validate ObjectId BEFORE querying
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const opportunity = await Opportunity.findById(id)
      .populate('partnerId', 'firstName lastName email profilePictureUrl orgName phone role');

    if (!opportunity) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found.' 
      });
    }

    const eventData = opportunity.toObject();

    // ✅ 2️⃣ Safe defaults
    eventData.attendees = eventData.attendees || [];

    // ✅ 3️⃣ Calculate occupancy
    eventData.totalAttendees = eventData.attendees.length;
    eventData.remainingSpots = Math.max(
      0,
      (eventData.requiredVolunteers || 0) - eventData.totalAttendees
    );

    // ✅ 4️⃣ Registration status (handle unauthenticated safely)
    const userId = req.user?._id;
    eventData.isRegistered = userId
      ? eventData.attendees.some(id => id.toString() === userId.toString())
      : false;

    // ✅ 5️⃣ Fetch Partner Profile if needed
    if (
      eventData.partnerId &&
      (eventData.partnerId.role === 'partner' ||
       eventData.partnerId.role === 'admin')
    ) {
      const partnerProfile = await PartnerProfile.findOne({
        userId: eventData.partnerId._id,
      });

      if (partnerProfile) {
        eventData.organizerName = partnerProfile.orgName;
        eventData.organizerLogo = partnerProfile.organizationLogoUrl;
      }
    }

    // ✅ 6️⃣ Fallback organizer name
    if (!eventData.organizerName && eventData.partnerId) {
      eventData.organizerName =
        `${eventData.partnerId.firstName} ${eventData.partnerId.lastName}`;
    }

    eventData.organizerPhone = eventData.partnerId?.phone || '';

    res.status(200).json({
      success: true,
      data: eventData,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
/**
 * @desc    Check-in to an event (Record physical arrival)
 * @route   POST /api/opportunities/:id/check-in
 * @access  Private
 */
const checkInToEvent = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (opportunity.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `This event is no longer active (status: ${opportunity.status}).`,
      });
    }

    const userId = req.user._id;

    // Check if already checked in
    const alreadyCheckedIn = opportunity.checkedInUsers.some(
      (id) => id.toString() === userId.toString()
    );
    
    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in to this event.',
      });
    }

    // Add to checkedInUsers
    opportunity.checkedInUsers.push(userId);
    
    // Also add to attendees if they hadn't pre-registered (walk-in scenario)
    const alreadyJoined = opportunity.attendees.some(
      (id) => id.toString() === userId.toString()
    );
    if (!alreadyJoined) {
        opportunity.attendees.push(userId);
    }
    
    await opportunity.save();

    // If user is a volunteer, ensure it's in their joined list
    if (req.user.role === 'volunteer') {
      await VolunteerProfile.findOneAndUpdate(
        { userId },
        { $addToSet: { joinedOpportunities: opportunity._id } },
        { upsert: true }
      );
    }

    // Impact log for the organizer (partner) - Arrival
    await ActivityLog.create({
      userId: opportunity.partnerId,
      type: 'Participant Arrival',
      content: `${req.user.firstName} arrived at "${opportunity.title}".`,
      relatedId: opportunity._id,
      relatedModel: 'Opportunity',
    });

    res.status(200).json({
      success: true,
      message: `You have arrived! Successfully checked in to "${opportunity.title}".`,
      data: opportunity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getUpcomingEvents,
  joinEvent,
  getMyRegisteredEvents,
  getEventDetails,
  checkInToEvent
};
