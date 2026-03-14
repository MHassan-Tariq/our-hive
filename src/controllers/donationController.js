const InKindDonation = require('../models/InKindDonation');
const MonetaryDonation = require('../models/MonetaryDonation');
const Sponsor = require('../models/Sponsor');
const User = require('../models/User');
const VolunteerProfile = require('../models/VolunteerProfile');
const DonorProfile = require('../models/DonorProfile');
const PartnerProfile = require('../models/PartnerProfile');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendNotification } = require('../utils/notificationService');

/**
 * @desc    Get donor dashboard overview
 * @route   GET /api/donations/dashboard
 * @access  Private (donor)
 */
const getDonorDashboard = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  // 1. Get Donations Made count
  const donationsCount = await InKindDonation.countDocuments({ donorId: req.user._id });

  // 2. Get Volunteer Hours
  const volunteerProfile = await VolunteerProfile.findOne({ userId: req.user._id });
  const hoursVolunteered = volunteerProfile ? volunteerProfile.totalHours : 0;

  // 3. Get Donor Profile (for monthly goal)
  let donorProfile = await DonorProfile.findOne({ userId: req.user._id });
  if (!donorProfile) {
    donorProfile = await DonorProfile.create({ userId: req.user._id });
  }

  const dashboardData = {
    greeting: `Hello, ${user.firstName || 'User'}!`,
    subHeader: "We are here to help you.",
    heroMessage: `Thanks You for YOUR Support, ${user.firstName || 'User'}!`,
    heroSubMessage: "Your Kindness is making a real difference in our community today.",
    impact: {
      hoursVolunteered: hoursVolunteered || 0,
      donationsMade: donationsCount || 0,
      monthlyGoal: donorProfile.monthlyGoal || 80,
    },
    quote: "Small acts, big changes."
  };

  res.status(200).json({
    success: true,
    data: dashboardData,
  });
});

/**
 * @desc    Offer an in-kind donation item
 * @route   POST /api/donations/offer
 * @access  Private (donor)
 */
const offerItem = asyncHandler(async (req, res, next) => {
  let {
    title,
    itemName,
    itemCategory,
    description,
    image,
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo,
    value,
    delivery_method,
    address,   // client sends this instead of pickupAddress
    notes,
    has_cat,
    has_dog
  } = req.body;

  // Map alternative names to internal ones
  if (value !== undefined && estimatedValue === undefined) estimatedValue = value;
  if (delivery_method && !deliveryMethod) deliveryMethod = delivery_method;
  if (notes && !additionalNotes) additionalNotes = notes;

  // Internal field name
  let pickupAddress = address ? address.toString().trim() : '';

  // Validate address
  if (!pickupAddress) return next(new ErrorResponse('address is required', 400));

  // Normalize booleans
  function toBool(val) {
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      return lower === '1' || lower === 'true' || lower === 'yes';
    }
    return false;
  }

  if ((has_cat !== undefined || has_dog !== undefined) && !petInfo) {
    petInfo = {
      hasCat: toBool(has_cat),
      hasDog: toBool(has_dog)
    };
  } else if (petInfo) {
    petInfo.hasCat = toBool(petInfo.hasCat);
    petInfo.hasDog = toBool(petInfo.hasDog);
  }

  // Set defaults
  if (!title) title = itemName || description ? (description.substring(0, 30) + '...') : 'In-Kind Donation';
  if (!itemName) itemName = description ? description.substring(0, 50) : 'In-Kind Donation';
  if (!itemCategory) itemCategory = 'Other';

  // Basic validation
  if (!title || !itemName || !itemCategory || !description) {
    return next(new ErrorResponse('title, itemName, itemCategory and description are required', 400));
  }

  if (!deliveryMethod) return next(new ErrorResponse('deliveryMethod is required', 400));

  // Handle file upload
  if (req.file) image = req.file.path;

  // parse petInfo if stringified
  if (typeof petInfo === 'string') {
    try {
      petInfo = JSON.parse(petInfo);
    } catch (e) { }
  }

  // Create donation with 'offered' status
  const donation = await InKindDonation.create({
    donorId: req.user._id,
    title,
    itemName,
    itemCategory,
    description,
    image,
    pickupAddress, // now a simple string
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo,
    status: 'offered'  // Explicitly set status to 'offered'
  });

  // OneSignal Notification to Donor
  await sendNotification(
    req.user._id,
    'Donation Offer Received',
    `Thank you! Your donation offer for "${title}" has been received and is pending review.`,
    'update',
    'checkmark'
  );

  res.status(201).json({
    success: true,
    message: 'Item posted successfully. Volunteers will be notified.',
    data: donation,
  });
});
/**
 * @desc    Get all donations posted by the logged-in donor
 * @route   GET /api/donations/my-donations
 * @access  Private (donor)
 */
const getMyDonations = asyncHandler(async (req, res, next) => {
  const { search } = req.query;
  let query = { donorId: req.user._id };

  if (search) {
    query.$or = [
      { itemName: { $regex: search, $options: 'i' } },
      { refId: { $regex: search, $options: 'i' } },
    ];
  }

  // Get ALL donations posted by this donor
  const donations = await InKindDonation.find(query)
    .populate('assignedVolunteerId', 'firstName lastName email phone')
    .sort({ createdAt: -1 });

  console.log(`Donor ${req.user._id} has ${donations.length} donations`);

  // Show ALL donations with status of who claimed them
  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    if (donation.assignedVolunteerId) {
      donationObj.claimedStatus = 'claimed';
      donationObj.isClaimed = true;
      donationObj.claimedBy = donation.assignedVolunteerId;
    } else {
      donationObj.claimedStatus = 'available';
      donationObj.isClaimed = false;
    }
    return donationObj;
  });

  res.status(200).json({
    success: true,
    count: transformedDonations.length,
    data: transformedDonations,
  });
});

/**
 * @desc    Get all available pickup items (status = 'offered')
 * @route   GET /api/donations/available-pickups
 * @access  Private (volunteer)
 */
const getAvailablePickups = asyncHandler(async (req, res, next) => {
  // Show ALL donations with personalized claimed status
  console.log('getAvailablePickups called for user:', req.user._id);
  
  const donations = await InKindDonation.find({})  // Get ALL donations
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email')
    .sort({ createdAt: -1 });

  console.log(`Found ${donations.length} offered donations for user ${req.user._id}`);

  // Fetch partner profile if user is a partner
  let partnerClaimedDonations = [];
  if (req.user && req.user.role === 'partner') {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });
    if (partnerProfile) {
      partnerClaimedDonations = partnerProfile.claimedDonations.map(id => id.toString());
    }
  }

  // Transform response - show ALL donations with personalized status
  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    const isClaimedByPartner = partnerClaimedDonations.includes(donation._id.toString());
    
    // For partners, force personalized status
    if (req.user && req.user.role === 'partner') {
        if (isClaimedByPartner) {
            donationObj.status = 'Claimed';
            donationObj.displayStatus = 'claimed';
            donationObj.isClaimed = true;
            donationObj.claimedByMe = true;
        } else {
            const finalStates = ['pickedup', 'delivered', 'approved'];
            const currentStatus = (donationObj.status || '').toLowerCase();
            
            if (!finalStates.includes(currentStatus)) {
                donationObj.status = 'Pending';
                donationObj.displayStatus = 'available';
                donationObj.isClaimed = false;
            }
            donationObj.claimedByMe = false;
        }
        return donationObj;
    }

    // Default Volunteer Logic
    if (donation.assignedVolunteerId && donation.assignedVolunteerId.toString() === req.user._id.toString()) {
      donationObj.displayStatus = 'claimed';
      donationObj.isClaimed = true;
      donationObj.claimedByMe = true;
    } 
    else if (donation.assignedVolunteerId) {
      donationObj.displayStatus = 'unavailable';
      donationObj.isClaimed = true;
      donationObj.claimedByMe = false;
    } 
    else {
      donationObj.displayStatus = 'available';
      donationObj.isClaimed = false;
      donationObj.claimedByMe = false;
    }
    
    return donationObj;
  });

  console.log(`Returning ${transformedDonations.length} donations to user`);

  res.status(200).json({
    success: true,
    count: transformedDonations.length,
    data: transformedDonations,
  });
});

/**
 * @desc    Claim a donation item (volunteer picks it up)
 * @route   PATCH /api/donations/:id/claim
 * @access  Private (volunteer)
 */
const claimDonation = asyncHandler(async (req, res, next) => {
  const donation = await InKindDonation.findById(req.params.id);

  if (!donation) {
    return next(new ErrorResponse('Donation item not found.', 404));
  }

  // Check if already claimed by someone
  if (donation.assignedVolunteerId) {
    if (donation.assignedVolunteerId.toString() === req.user._id.toString()) {
      return next(new ErrorResponse('You have already claimed this item.', 400));
    }
    return next(new ErrorResponse('This item has already been claimed by another volunteer.', 400));
  }

  // Allow claiming any unclaimed donation regardless of status
  // Only track that this user has claimed it via assignedVolunteerId
  donation.assignedVolunteerId = req.user._id;
  await donation.save();

  const populated = await InKindDonation.findById(donation._id)
    .populate('donorId', 'name email')
    .populate('assignedVolunteerId', 'name email');

  res.status(200).json({
    success: true,
    message: `Item claimed! Pickup address is now available.`,
    data: populated,
  });
});

/**
 * @desc    Get donations assigned to the logged-in partner (recipient)
 * @route   GET /api/donations/assigned
 * @access  Private (partner)
 */
const getAssignedDonations = asyncHandler(async (req, res, next) => {
  const partnerId = req.user._id;
  const { status, search } = req.query;
  
  // Fetch partner profile to check for claimed donations
  let partnerClaimedDonations = [];
  const partnerProfile = await PartnerProfile.findOne({ userId: partnerId });
  if (partnerProfile) {
    partnerClaimedDonations = partnerProfile.claimedDonations || [];
  }

  // Get ALL donations assigned to this partner OR claimed by them locally
  let query = { 
    $or: [
      { recipientId: partnerId },
      { _id: { $in: partnerClaimedDonations } }
    ]
  };

  if (status) {
    // Optional filter if status is specified
    if (status === 'pending') {
      query.status = { $regex: '^(offered|pending)$', $options: 'i' };
    } else if (status === 'in-transit') {
      query.status = { $regex: '^in-transit$', $options: 'i' };
    } else if (status === 'delivered') {
      query.status = { $regex: '^delivered$', $options: 'i' };
    } else if (status === 'claimed') {
        // If they filter by claimed, we want to show anything they claimed locally
        // or anything with global status 'Claimed' that reached them
        query.status = { $regex: '^claimed$', $options: 'i' };
        // We might want to adjust this to show their locally claimed items too, 
        // but $or query above handles the fetch. This filter narrows it down.
    } else {
      query.status = status;
    }
  }
  // No default status filter - show all donations for this partner

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { itemCategory: { $regex: search, $options: 'i' } },
    ];
  }

  const donations = await InKindDonation.find(query)
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email phone')
    .sort({ createdAt: -1 });

  console.log(`Found ${donations.length} donations assigned to partner ${partnerId}`);

  // Transform to show ALL assigned donations with personalized display status
  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    const isClaimedByPartner = partnerClaimedDonations.some(id => id.toString() === donation._id.toString());
    
    // For partners, the "status" field is entirely personalized for Claimed state
    if (isClaimedByPartner) {
        donationObj.status = 'Claimed'; 
        donationObj.displayStatus = 'claimed';
        donationObj.claimedByMe = true;
    } else if (donation.assignedVolunteerId && donation.assignedVolunteerId.toString() === partnerId.toString()) {
        donationObj.status = 'Claimed';
        donationObj.displayStatus = 'claimed';
        donationObj.claimedByMe = true;
    } else {
        // If not claimed by me but in this list (meaning assigned globally),
        // we check if we should still show it as available or something else
        const finalStates = ['pickedup', 'delivered', 'approved'];
        const currentStatus = (donationObj.status || '').toLowerCase();
        
        if (!finalStates.includes(currentStatus)) {
            donationObj.status = 'Pending';
            donationObj.displayStatus = 'available';
        }
        donationObj.claimedByMe = false;
    }
    
    return donationObj;
  });

  res.status(200).json({
    success: true,
    count: transformedDonations.length,
    data: transformedDonations,
  });
});

/**
 * @desc    Update donor profile (e.g. monthly goal)
 * @route   PATCH /api/donations/profile
 * @access  Private (donor)
 */
const updateDonorProfile = asyncHandler(async (req, res, next) => {
  const { monthlyGoal } = req.body;

  const donorProfile = await DonorProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { monthlyGoal } },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: donorProfile,
  });
});

/**
 * @desc    Update a pending in-kind donation
 * @route   PATCH /api/donations/:id
 * @access  Private (donor)
 */
const updateDonation = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  let {
    itemName,
    itemCategory,
    description,
    pickupAddress,
    quantity,
    estimatedValue,
    deliveryMethod,
    additionalNotes,
    petInfo
  } = req.body;

  const donation = await InKindDonation.findOne({ _id: id, donorId: req.user._id });

  if (!donation) {
    return next(new ErrorResponse('Donation not found', 404));
  }

  if (donation.status !== 'pending') {
    return next(new ErrorResponse('Only pending donations can be edited', 400));
  }

  // Handle file upload
  if (req.file) {
    donation.image = req.file.path;
  }

  // Handle stringified objects from multipart/form-data
  if (typeof pickupAddress === 'string') {
    try { pickupAddress = JSON.parse(pickupAddress); } catch (e) { }
  }
  if (typeof petInfo === 'string') {
    try { petInfo = JSON.parse(petInfo); } catch (e) { }
  }

  donation.itemName = itemName || donation.itemName;
  donation.itemCategory = itemCategory || donation.itemCategory;
  donation.description = description || donation.description;
  donation.pickupAddress = pickupAddress || donation.pickupAddress;
  donation.quantity = quantity || donation.quantity;
  donation.estimatedValue = estimatedValue || donation.estimatedValue;
  donation.deliveryMethod = deliveryMethod || donation.deliveryMethod;
  donation.additionalNotes = additionalNotes || donation.additionalNotes;
  donation.petInfo = petInfo || donation.petInfo;

  await donation.save();

  res.status(200).json({
    success: true,
    message: 'Donation updated successfully',
    data: donation,
  });
});

/**
 * @desc    Get all available in-kind donations (public)
 * @route   GET /api/donations/all
 * @access  Public
 */
const getAllDonations = asyncHandler(async (req, res, next) => {
  const { search, category, status } = req.query;

  // Fetch partner claimed donations
  let partnerClaimedDonations = [];
  if (req.user && req.user.role === "partner") {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });

    if (partnerProfile) {
      partnerClaimedDonations = partnerProfile.claimedDonations.map(id =>
        id.toString()
      );
    }
  }

  let query = {};

  if (search) {
    query.$or = [
      { itemName: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

  if (category) {
    query.itemCategory = category;
  }

  // Status filter
  if (status && req.user && req.user.role === "partner") {
    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus === "claimed") {
      query._id = { $in: partnerClaimedDonations };
    } 
    else if (normalizedStatus === "pending") {
      query._id = { $nin: partnerClaimedDonations };
      query.status = { $nin: ["pickedup", "delivered", "approved"] };
    } 
    else if (normalizedStatus !== "all") {
      query.status = normalizedStatus;
    }
  } 
  else if (status && status !== "all") {
    query.status = status.toLowerCase();
  }

  const donations = await InKindDonation.find(query)
    .populate("donorId", "firstName lastName email")
    .populate("assignedVolunteerId", "firstName lastName email")
    .populate("recipientId", "firstName lastName email")
    .sort({ createdAt: -1 });

  const transformedDonations = donations.map(donation => {
    const donationObj = donation.toObject();
    const isClaimedByPartner = partnerClaimedDonations.includes(
      donation._id.toString()
    );

    if (req.user && req.user.role === "partner") {
      if (isClaimedByPartner) {
        donationObj.status = "claimed";
        donationObj.displayStatus = "claimed";
        donationObj.claimedByMe = true;
        donationObj.isClaimed = true;
      } else {
        const finalStates = ["pickedup", "delivered", "approved"];
        const currentStatus = (donationObj.status || "").toLowerCase();

        if (!finalStates.includes(currentStatus)) {
          donationObj.status = "pending";
          donationObj.displayStatus = "available";
          donationObj.isClaimed = false;
        }

        donationObj.claimedByMe = false;
      }

      return donationObj;
    }

    if (
      req.user &&
      donation.assignedVolunteerId &&
      donation.assignedVolunteerId.toString() === req.user._id.toString()
    ) {
      donationObj.status = "claimed";
      donationObj.displayStatus = "claimed";
      donationObj.claimedByMe = true;
      donationObj.isClaimed = true;
    } 
    else if (donation.assignedVolunteerId) {
      donationObj.displayStatus = "unavailable";
      donationObj.claimedByMe = false;
      donationObj.isClaimed = true;
    } 
    else {
      donationObj.displayStatus = "available";
      donationObj.claimedByMe = false;
      donationObj.isClaimed = false;
    }

    return donationObj;
  });

  // Log statuses
  console.log("Returned Donation Statuses:");
  transformedDonations.forEach(d => {
    console.log(`Donation ${d._id} → status: ${d.status}, displayStatus: ${d.displayStatus}`);
  });

  res.status(200).json({
    success: true,
    count: transformedDonations.length,
    data: transformedDonations
  });
});

const ChangeDonationStatus = asyncHandler(async (req, res, next) => {
  const { donationId } = req.params;
  let { status } = req.body;
  if (status && typeof status === 'string') {
    status = status.replace(/^["'](.+)["']$/, '$1').trim();
  }
  
  const allowedStatuses = ["available", "claimed", "pickedup", "delivered", "approved", "all"];
  const normalizedStatus = status ? status.toLowerCase() : '';

  if (!status || !allowedStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status value: ${status}`,
    });
  }
  
  const donation = await InKindDonation.findById(donationId);
  if (!donation) {
    return res.status(404).json({
      success: false,
      message: "Donation not found",
    });
  }
  
  const validTransitions = {
    pending: ["Available", "Claimed"],
    available: ["Claimed"],
    claimed: ["PickedUp"],
    delivered: ["Delivered"],
    pickedup: [],
  };

  if (req.file) {
    donation.image = req.file.path;
  }

  // Assign donation to the partner who is picking it up or delivering it
  if (['pickedup', 'delivered', 'claimed'].includes(normalizedStatus) && req.user) {
    donation.recipientId = req.user._id;

    // Special handling for Partner Claim - store in user's profile instead of global status
    if (normalizedStatus === 'claimed' && req.user.role === 'partner') {
      await PartnerProfile.findOneAndUpdate(
        { userId: req.user._id },
        { $addToSet: { claimedDonations: donationId } },
        { new: true, upsert: true }
      );
      // We don't change the global status here if they want it to be local
      // But we still want to save the recipientId
      await donation.save();

      return res.status(200).json({
        success: true,
        message: "Donation claimed successfully in your profile",
        data: donation,
      });
    }
  }

  donation.status = status; // Keep original casing for saved status if desired, or normalizedStatus
  await donation.save();

  // OneSignal Notification to Donor
  await sendNotification(
    donation.donorId,
    'Donation Update',
    `The status of your donation "${donation.itemName}" has been updated to ${status}.`,
    'update',
    'info'
  );
  res.status(200).json({
    success: true,
    message: "Donation status updated successfully",
    data: donation,
  });
});
/**
 * @desc    Get a specific in-kind donation by ID
 * @route   GET /api/donations/:id
 * @access  Public
 */
const getInKindDonationById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const donation = await InKindDonation.findById(id)
    .populate('donorId', 'firstName lastName email')
    .populate('assignedVolunteerId', 'firstName lastName email phone')
    .populate('recipientId', 'firstName lastName email');

  if (!donation) {
    return next(new ErrorResponse('In-kind donation not found', 404));
  }

  const donationData = donation.toObject();

  // Personalized status for partner
  let isClaimedByPartner = false;
  if (req.user && req.user.role === 'partner') {
    const partnerProfile = await PartnerProfile.findOne({ userId: req.user._id });
    if (partnerProfile && (partnerProfile.claimedDonations || []).some(cid => cid.toString() === id)) {
      isClaimedByPartner = true;
    }
  }

  // Show personalized display status based on who's viewing
  if (req.user && req.user.role === 'partner') {
    if (isClaimedByPartner) {
        donationData.status = 'Claimed'; 
        donationData.displayStatus = 'claimed';
        donationData.claimedByMe = true;
        donationData.isClaimed = true;
    } else {
        const finalStates = ['pickedup', 'delivered', 'approved'];
        const currentStatus = (donationData.status || '').toLowerCase();
        
        if (!finalStates.includes(currentStatus)) {
            donationData.status = 'Pending';
            donationData.displayStatus = 'available';
            donationData.isClaimed = false;
        }
        donationData.claimedByMe = false;
    }
  } else if (req.user && donation.assignedVolunteerId && donation.assignedVolunteerId.toString() === req.user._id.toString()) {
    // This user claimed it
    donationData.status = 'Claimed';
    donationData.displayStatus = 'claimed';
    donationData.claimedByMe = true;
    donationData.isClaimed = true;
  } else if (donation.assignedVolunteerId) {
    // Someone else claimed it
    donationData.displayStatus = 'unavailable';
    donationData.claimedByMe = false;
    donationData.isClaimed = true;
  } else {
    // Available
    donationData.displayStatus = 'available';
    donationData.claimedByMe = false;
    donationData.isClaimed = false;
  }

  res.status(200).json({
    success: true,
    data: donationData,
  });
});

/**
 * @desc    Zeffy Webhook Handler (via Zapier)
 * @route   POST /api/webhooks/zeffy
 * @access  Public (Webhook)
 */
const zeffyWebhook = asyncHandler(async (req, res) => {
  console.log('🔔 Zeffy Webhook Received');
  console.log('Raw Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', req.headers);

  try {
    // Handle both array and object formats from Zapier
    let payload = req.body;
    
    // If array with single object, extract the object
    if (Array.isArray(payload) && payload.length > 0) {
      payload = payload[0];
    }

    // If payload is wrapped in an object with data property, extract it
    if (payload && payload.data && !payload.donor_email) {
      payload = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    }

    console.log('Extracted Payload:', JSON.stringify(payload, null, 2));

    const {
      donation_id,
      donor_email,
      donor_name,
      amount,
      currency,
      transaction_date,
      campaign_id,
      campaign_name,
      payment_status,
      is_anonymous,
      organization_name,
      recurring
    } = payload;

    // Validate required fields
    if (!donor_email || !amount || !payment_status) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: donor_email, amount, payment_status',
        received: { donor_email, amount, payment_status }
      });
    }

    // Only process successful payments
    if (payment_status !== 'completed' && payment_status !== 'succeeded') {
      console.log(`⏭️  Skipping payment with status: ${payment_status}`);
      return res.status(200).json({
        success: true,
        message: `Payment status: ${payment_status}. No action needed.`
      });
    }

    // Find or create donor user
    let donor = await User.findOne({ email: donor_email });
    if (!donor) {
      // Extract name parts
      const nameParts = (donor_name || 'Anonymous Donor').trim().split(' ');
      const firstName = nameParts[0] || 'Anonymous';
      const lastName = nameParts.slice(1).join(' ') || '';

      donor = await User.create({
        firstName,
        lastName,
        email: donor_email,
        password: Math.random().toString(36).slice(-10),
        role: 'sponsor',
        isApproved: true
      });

      // Create sponsor profile
      await Sponsor.create({
        userId: donor._id,
        organizationName: organization_name || firstName,
        isAnonymous: is_anonymous || false
      });

      console.log(`✅ New donor created: ${donor._id}`);
    }

    // Find sponsor profile
    let sponsorProfile = await Sponsor.findOne({ userId: donor._id });
    if (!sponsorProfile) {
      sponsorProfile = await Sponsor.create({
        userId: donor._id,
        organizationName: organization_name || donor.firstName
      });
    }

    // Calculate meals provided ($2.50 = 1 meal)
    const mealsProvided = Math.floor(amount / 2.5);

    // Create monetary donation record
    const donation = await MonetaryDonation.create({
      sponsorId: donor._id,
      amount,
      currency: currency || 'USD',
      mealsProvided,
      paymentMethod: 'Zeffy',
      projectTitle: campaign_name || 'General Donation',
      isAnonymous: is_anonymous || false,
      isMonthly: recurring || false,
      organizationName: organization_name || donor.firstName,
      transactionId: donation_id,
      date: transaction_date ? new Date(transaction_date) : new Date(),
      status: 'completed'
    });

    console.log(`✅ Donation recorded: ${donation._id}`);

    // Update sponsor profile - increase total contributed and calculate tier
    const newTotal = sponsorProfile.totalContributed + amount;
    const tierUpgrade = Sponsor.getTier(newTotal) !== sponsorProfile.tier;

    await Sponsor.findByIdAndUpdate(
      sponsorProfile._id,
      {
        $inc: { totalContributed: amount },
        tier: Sponsor.getTier(newTotal),
        isMonthlySupporter: recurring || sponsorProfile.isMonthlySupporter,
        organizationName: organization_name || sponsorProfile.organizationName,
        isAnonymous: is_anonymous !== undefined ? is_anonymous : sponsorProfile.isAnonymous
      },
      { new: true }
    );

    console.log(`✅ Sponsor profile updated. New tier: ${Sponsor.getTier(newTotal)}`);

    // OneSignal Notification for Payment
    await sendNotification(
      donor._id,
      'Payment Received',
      `Success! Your donation of ${amount} ${currency || 'USD'} has been processed. Thank you for your support!`,
      'approval',
      'checkmark'
    );

    res.status(200).json({
      success: true,
      message: 'Payment received and processed successfully',
      data: {
        donorId: donor._id,
        donorEmail: donor.email,
        donationId: donation._id,
        amount,
        mealsProvided,
        tierUpgraded,
        newTier: Sponsor.getTier(newTotal)
      }
    });
  } catch (err) {
    console.error('❌ Zeffy Webhook Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
});

const submitMonetaryDonation = asyncHandler(async (req, res, next) => {
  const { amount, isMonthly, eventId } = req.body;

  if (!amount || !eventId) {
    return next(new ErrorResponse('Please provide amount and event ID', 400));
  }

  const campaign = await require('../models/Opportunity').findById(eventId);
  if (!campaign) {
    return next(new ErrorResponse('Event not found', 404));
  }

  const donation = await MonetaryDonation.create({
    sponsorId: req.user._id,
    eventId,
    projectTitle: campaign.title,
    amount,
    isMonthly: isMonthly === true || isMonthly === 'true',
    status: 'pending',
    paymentMethod: 'Zeffy'
  });

  // OneSignal Notification for Pledge
  await sendNotification(
    req.user._id,
    'Donation Pledge Recorded',
    `Your pledge for "${campaign.title}" is recorded. Please tap to complete your donation on Zeffy.`,
    'update',
    'info'
  );

  res.status(201).json({
    success: true,
    message: 'Donation pledge recorded. Please complete payment on Zeffy.',
    donationLink: campaign.externalDonationUrl,
    data: donation
  });
});

/**
 * @desc    Get my monetary donations
 * @route   GET /api/donations/monetary/my
 * @access  Private (donor/sponsor)
 */
const getMyMonetaryDonations = asyncHandler(async (req, res, next) => {
  const donations = await MonetaryDonation.find({ sponsorId: req.user._id })
    .populate('eventId', 'title')
    .sort({ createdAt: -1 });

  // 1. Calculate Total Donation Amount (All pledges)
  const totalDonationAmount = donations.reduce((acc, d) => acc + (d.amount || 0), 0);

  // 2. Calculate Total Approved Donation Amount (Completed only)
  const approvedDonations = donations.filter(d => d.status === 'completed');
  const totalApprovedDonationAmount = approvedDonations.reduce((acc, d) => acc + (d.amount || 0), 0);
  const approvedDonationsCount = approvedDonations.length;

  // 3. Transform data to requested format
  const formattedDonations = donations.map(d => ({
    name: d.projectTitle,
    date: d.date,
    amount: d.amount,
    status: d.status
  }));

  res.status(200).json({
    success: true,
    totalDonationAmount,
    totalApprovedDonationAmount,
    // approvedDonationsCount,
    count: formattedDonations.length,
    data: formattedDonations
  });
});

module.exports = {
  offerItem,
  getMyDonations,
  getAvailablePickups,
  claimDonation,
  getAssignedDonations,
  getDonorDashboard,
  updateDonorProfile,
  updateDonation,
  getAllDonations,
  getInKindDonationById,
  ChangeDonationStatus,
  zeffyWebhook,
  submitMonetaryDonation,
  getMyMonetaryDonations
};
