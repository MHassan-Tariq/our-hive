const User = require('../models/User');
const PartnerProfile = require('../models/PartnerProfile');
const VolunteerProfile = require('../models/VolunteerProfile');
const Sponsor = require('../models/Sponsor');
const Opportunity = require('../models/Opportunity');
const Campaign = require('../models/Campaign');
const SystemSettings = require('../models/SystemSettings');

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
    const query = { status: { $in: ['Confirmed', 'Active'] } };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const opportunitiesRaw = await Opportunity.find(query)
      .select('title description location date category requiredVolunteers imageurl time endTime partnerId whatToBring requirements')
      .sort({ createdAt: -1 });

    // Enrich with PartnerProfile data
    const opportunities = await Promise.all(opportunitiesRaw.map(async (opp) => {
      const oppObj = opp.toObject();
      if (oppObj.partnerId) {
        const partnerProfile = await PartnerProfile.findOne({ userId: oppObj.partnerId });
        if (partnerProfile) {
          oppObj.partnerId = {
            _id: oppObj.partnerId,
            orgName: partnerProfile.orgName,
            organizationLogoUrl: partnerProfile.organizationLogoUrl
          };
        }
      }
      return oppObj;
    }));

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
    const { filter = 'today', search } = req.query;
    const now = new Date();
    let startDate, endDate;

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

    if (filter === 'all') {
      startDate = null;
      endDate = null;
    } 
    else if (filter === 'tomorrow') {
      startDate = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      endDate = endOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    } 
    else if (filter === 'this_week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;

      startDate = startOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
      );

      endDate = endOfDay(
        new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000)
      );
    } 
    else {
      startDate = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      endDate = endOfDay(now);
    }

    const query = {
      status: { $in: ['Confirmed', 'Active'] }
    };

    if (filter !== 'all') {
      query.date = { $gte: startDate, $lte: endDate };
    }

    // 🔎 Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
      ];
    }

    const slots = await Opportunity.find(query)
      .select(
        'title location specificLocation coordinates date time endTime imageurl category partnerId createdAt attendees requiredVolunteers whatToBring requirements'
      )
      .sort({ date: 1, time: 1 });

    const partnerIds = [
      ...new Set(slots.map((s) => s.partnerId?.toString()).filter(Boolean)),
    ];

    const partnerProfiles = await PartnerProfile.find({
      userId: { $in: partnerIds },
    });

    const profileMap = partnerProfiles.reduce((map, p) => {
      map[p.userId.toString()] = p;
      return map;
    }, {});

    const currentUserId = req.user ? req.user.id : null;

    const parseTime = (timeStr) => {
      if (!timeStr) return null;

      const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return null;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3] ? match[3].toUpperCase() : null;

      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;

      return { hours, minutes };
    };

    const enrichedSlots = slots
      .map((slot) => {
        const slotObj = slot.toObject();
        let isOpenNow = false;
        let closesInMinutes = null;

        if (slotObj.date && slotObj.time && slotObj.endTime) {
          const slotDate = new Date(slotObj.date);

          const startTimeParsed = parseTime(slotObj.time);
          const endTimeParsed = parseTime(slotObj.endTime);

          if (startTimeParsed && endTimeParsed) {
            const openTime = new Date(slotDate);
            openTime.setHours(startTimeParsed.hours, startTimeParsed.minutes, 0, 0);

            let closeTime = new Date(slotDate);
            closeTime.setHours(endTimeParsed.hours, endTimeParsed.minutes, 0, 0);

            if (closeTime < openTime) {
              closeTime.setDate(closeTime.getDate() + 1);
            }

            if (now >= openTime && now <= closeTime) {
              isOpenNow = true;
              closesInMinutes = Math.floor((closeTime - now) / (1000 * 60));
            }

            if (filter === "today" || !req.query.filter) {
              const todayStart = startOfDay(now);
              const slotDateStart = startOfDay(slotDate);

              if (slotDateStart < todayStart) {
                if (closeTime < todayStart) {
                  return null;
                }
              }
            }
          }
        }

        slotObj.isOpenNow = isOpenNow;
        slotObj.closesInMinutes = closesInMinutes;

        const attendeesCount = slotObj.attendees ? slotObj.attendees.length : 0;

        slotObj.totalAttendees = attendeesCount;
        slotObj.remainingSpots = Math.max(
          0,
          (slotObj.requiredVolunteers || 0) - attendeesCount
        );

        slotObj.isRegistered = currentUserId
          ? slotObj.attendees.some(
              (id) => id.toString() === currentUserId.toString()
            )
          : false;

        delete slotObj.attendees;

        const partnerProfile = profileMap[slotObj.partnerId?.toString()];

        if (partnerProfile) {
          slotObj.partnerId = {
            _id: slotObj.partnerId,
            orgName: partnerProfile.orgName,
            organizationLogoUrl: partnerProfile.organizationLogoUrl,
          };
        } else if (slotObj.partnerId) {
          slotObj.partnerId = {
            _id: slotObj.partnerId,
            orgName: "Our Hive Partner",
          };
        }

        return slotObj;
      })
      .filter((slot) => slot !== null);

    res.status(200).json({
      success: true,
      filter,
      search: search || null,
      count: enrichedSlots.length,
      data: enrichedSlots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
/**
 * @desc    Get details for a specific opportunity (Public)
 * @route   GET /api/public/opportunities/:id
 * @access  Public
 */
exports.getOpportunityDetails = async (req, res) => {
  try {
    console.log('========== getOpportunityDetails called ==========');
    console.log(`Route: GET ${req.originalUrl}`);
    console.log('User:', req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : 'Guest');

    const opportunity = await Opportunity.findById(req.params.id)
      .populate('partnerId', 'firstName lastName email profilePictureUrl orgName phone');

    if (!opportunity) {
      console.log('❌ Opportunity not found for ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    }

    console.log('✅ Opportunity found:', opportunity._id);

    const publicOpportunity = opportunity.toObject();
    const currentUserId = req.user ? req.user._id : null;

    publicOpportunity.isRegistered = currentUserId
      ? publicOpportunity.attendees.some(id => id.toString() === currentUserId.toString())
      : false;

    console.log('Current user registered status:', publicOpportunity.isRegistered);

    const donors = await User.find({
      _id: { $in: publicOpportunity.attendees },
      role: 'donor'
    });
    publicOpportunity.totalDonors = donors.length;

    console.log('Total donors among attendees:', publicOpportunity.totalDonors);

    if (publicOpportunity.partnerId) {
      console.log('Partner ID populated:', publicOpportunity.partnerId._id);
      const partnerProfile = await PartnerProfile.findOne({ userId: publicOpportunity.partnerId._id });

      if (partnerProfile) {
        console.log('PartnerProfile found:', partnerProfile._id);
        publicOpportunity.partnerId.orgName = partnerProfile.orgName;
        publicOpportunity.partnerId.organizationLogoUrl = partnerProfile.organizationLogoUrl;
        publicOpportunity.organizerName = partnerProfile.orgName;
        publicOpportunity.organizerLogo = partnerProfile.organizationLogoUrl;
        publicOpportunity.partnerId.profilePictureUrl = partnerProfile.organizationLogoUrl;

        // Use phone from partnerProfile if User.phone is empty
        publicOpportunity.organizerPhone = publicOpportunity.partnerId.phone || partnerProfile.phone || '';
        console.log('Organizer phone assigned from partnerProfile/User:', publicOpportunity.organizerPhone);
      } else {
        publicOpportunity.organizerPhone = publicOpportunity.partnerId.phone || '';
        console.log('Organizer phone assigned from partner User only:', publicOpportunity.organizerPhone);
      }
    }

    if (!publicOpportunity.organizerName && publicOpportunity.partnerId) {
      publicOpportunity.organizerName = `${publicOpportunity.partnerId.firstName} ${publicOpportunity.partnerId.lastName}`;
    }

    delete publicOpportunity.attendees;

    console.log('Returning publicOpportunity:', {
      _id: publicOpportunity._id,
      organizerName: publicOpportunity.organizerName,
      organizerPhone: publicOpportunity.organizerPhone
    });

    res.status(200).json({
      success: true,
      data: publicOpportunity
    });
  } catch (err) {
    console.error('❌ Error in getOpportunityDetails:', err);
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
 * @desc    Get social links from system settings
 * @route   GET /api/public/social-links
 * @access  Public
 */
exports.getSocialLinks = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    
    res.status(200).json({
      success: true,
      data: settings.socialLinks
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
