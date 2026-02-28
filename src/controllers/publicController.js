const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const Opportunity = require('../models/Opportunity');
const Campaign = require('../models/Campaign');

/**
 * @desc    Get community impact statistics
 * @route   GET /api/public/stats
 * @access  Public
 */
exports.getStats = async (req, res) => {
  try {
    const totalBees = await User.countDocuments();
    const activeHives = await PartnerProfile.countDocuments({ status: 'approved' });
    
    const volunteerImpact = await VolunteerProfile.aggregate([
      { $group: { _id: null, totalHours: { $sum: '$totalHours' } } }
    ]);

    const financialSupport = await Sponsor.aggregate([
      { $group: { _id: null, totalRaised: { $sum: '$totalContributed' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBees,
        activeHives,
        volunteerImpact: volunteerImpact[0]?.totalHours || 0,
        financialSupport: financialSupport[0]?.totalRaised || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get all approved partners (Hives)
 * @route   GET /api/public/hives
 * @access  Public
 */
exports.getHives = async (req, res) => {
  try {
    const hives = await PartnerProfile.find({ status: 'approved' })
      .select('orgName orgType address website')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: hives.length,
      data: hives
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get all active opportunities
 * @route   GET /api/public/opportunities
 * @access  Public
 */
exports.getOpportunities = async (req, res) => {
  try {
    const { search, category } = req.query;

    // Build query object
    const query = { status: 'Confirmed' };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const opportunities = await Opportunity.find(query)
      .select('title description location date category requiredVolunteers')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get food distribution schedule (Today / Tomorrow / This Week)
 * @route   GET /api/public/schedule
 * @access  Public
 */
exports.getDistributionSchedule = async (req, res) => {
  try {
    const { filter = 'today' } = req.query;
    const now = new Date();
    let startDate, endDate;

    // Helper to set time to start of day
    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // Helper to set time to end of day
    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    if (filter === 'tomorrow') {
      startDate = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      endDate = endOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    } else if (filter === 'this_week') {
      const day = now.getDay(); // 0 = Sunday, 1 = Monday ...
      const diffToMonday = day === 0 ? -6 : 1 - day; // adjust so week starts Monday
      startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday));
      endDate = endOfDay(new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000)); // Sunday end
    } else {
      // default: today
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    }

    // Query by createdAt
    const query = {
      status: 'Confirmed',
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const slots = await Opportunity.find(query)
      .select('title location specificLocation coordinates date time endTime imageurl category partnerId createdAt')
      .populate('partnerId', 'orgName organizationLogoUrl')
      .sort({ createdAt: 1 });

    // Optional enrichment (can keep for front-end)
    const enrichedSlots = slots.map(slot => {
      const slotObj = slot.toObject();
      let isOpenNow = false;
      let closesInMinutes = null;

      if (slotObj.date && slotObj.time && slotObj.endTime) {
        const slotDate = new Date(slotObj.date);
        const [openHour, openMin] = slotObj.time.split(':').map(Number);
        const [closeHour, closeMin] = slotObj.endTime.split(':').map(Number);

        const openTime = new Date(slotDate);
        openTime.setHours(openHour, openMin, 0, 0);

        const closeTime = new Date(slotDate);
        closeTime.setHours(closeHour, closeMin, 0, 0);

        if (now >= openTime && now <= closeTime) {
          isOpenNow = true;
          closesInMinutes = Math.round((closeTime - now) / 60000);
        }
      }

      slotObj.isOpenNow = isOpenNow;
      slotObj.closesInMinutes = closesInMinutes;

      return slotObj;
    });

    res.status(200).json({
      success: true,
      filter,
      count: enrichedSlots.length,
      data: enrichedSlots
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get details for a specific opportunity (Public)
 * @route   GET /api/public/opportunities/:id
 * @access  Public
 */
exports.getOpportunityDetails = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate('partnerId', 'firstName lastName email profilePictureUrl orgName');

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    }

    // Convert to plain object to manipulate for the public payload
    const publicOpportunity = opportunity.toObject();

    // Calculate remaining spots
    publicOpportunity.remainingSpots = Math.max(
      0, 
      (publicOpportunity.requiredVolunteers || 0) - (publicOpportunity.attendees ? publicOpportunity.attendees.length : 0)
    );

    // Strip out sensitive inner details (like the actual attendee IDs, if this is public)
    delete publicOpportunity.attendees;

    res.status(200).json({
      success: true,
      data: publicOpportunity
    });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
         return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    }
    res.status(500).json({ success: false, message: 'Server error retrieving opportunity details' });
  }
};

/**
 * @desc    Get all active campaigns (Community Updates)
 * @route   GET /api/public/campaigns
 * @access  Public
 */
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ isActive: true })
      .select('title description imageUrl category externalDonationUrl createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: campaigns.length,
      data: campaigns
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get Overarching Organization About Us Details
 * @route   GET /api/public/about
 * @access  Public
 */
exports.getAboutUs = async (req, res) => {
  try {
    // Return static data structure mimicking a global config or CMS record
    // to populate the "About Us" Screen (15) accurately.
    res.status(200).json({
      success: true,
      data: {
        title: "Our Hive",
        subtitle: "Powered By Mrs'Bs Table",
        heroImageUrl: null, // CMS-managed banner image
        logoUrl: null,      // Organization logo (OH icon)
        mission: "Our Hive is a nonprofit organization dedicated to providing nourishment, dignity, and community support to families in need.",
        story: "Founded in 2015, Our Hive Table began in a small home kitchen with a big dream : ensuring no neighbor goes to bed hungry. What started as a weekly potluck has grown into a daily operation, fueled by the generosity of of our local community and volunteers. We believe that a shared meal is the first step towards building a stronger community.",
        stats: {
          mealsServed: "10K +",
          familiesHelped: "500 +"
        },
        ctaLabel: "Join Our Table"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving about us data' });
  }
};

/**
 * @desc    Get Central Organization Contact Details & Links
 * @route   GET /api/public/contact
 * @access  Public
 */
exports.getContactInfo = async (req, res) => {
  try {
    // Return static data mimicking a CMS payload for the "Contact Us" Screen
    res.status(200).json({
      success: true,
      data: {
        heroImageUrl: null, // CMS-managed banner image
        heroTagline: "We are here to help",
        introText: "Have question about food distribution or volunteering? We love to hear from you.",
        email: "hello@nonprofit.org",
        phone: "+1(555)123-4567",
        address: "123 Community lan, Food Ciy, FC90210",
        socials: {
          linkedin: "https://linkedin.com/company/nonprofit-food-org",
          facebook: "https://facebook.com/nonprofitfoodorg",
          website: "https://nonprofitfoodorg.org",
          instagram: "https://instagram.com/nonprofitfoodorg"
        },
        viewAllResourcesUrl: null, // Link for the "View All Resources" CTA
        copyright: "2024 Nonprofit Food Org, All right reserved.",
        footerText: "Powered by Mrs'Bs Table"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving contact info' });
  }
};

/**
 * @desc    Get list of available user roles for registration (Let's Get Started screen)
 * @route   GET /api/public/user-roles
 * @access  Public
 */
exports.getUserRoles = async (req, res) => {
  try {
    const roles = [
      {
        key: 'participant',
        label: 'Participant',
        description: 'I need assistance and resources',
        icon: 'participant'
      },
      {
        key: 'volunteer',
        label: 'Volunteer',
        description: 'I want to volunteer my time',
        icon: 'volunteer'
      },
      {
        key: 'donor',
        label: 'In-Kind Donation',
        description: 'I want to schedule a donation pickup/drop off',
        icon: 'donor'
      },
      {
        key: 'sponsor',
        label: 'Sponsor / Supporter',
        description: 'I want to make a monetary donation',
        icon: 'sponsor'
      },
      {
        key: 'partner',
        label: 'Community Partners',
        description: 'I have a business or nonprofit and want to work together',
        icon: 'partner'
      }
    ];

    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving roles' });
  }
};

/**
 * @desc    Get aggregate mission impact stats (legacy/mission-specific)
 * @route   GET /api/public/mission-stats
 * @access  Public
 */
exports.getMissionStats = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      mealsServed: "1.2k+",
      familiesHelped: 450,
      activeHubs: 15,
      missionStatement: "Your contribution helps us provide meals, resources, and support to our community. Every \"honeycomb\" in our hive makes us stronger."
    }
  });
};
