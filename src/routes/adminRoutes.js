const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  getAllUsers,
  getDashboard,
  updatePartnerStatus,
  updateOpportunityStatus,
  addVolunteerHours,
  adminApproveVolunteerHours,
  getFinances,
  getParticipantSummary,
  adminListParticipants,
  adminGetParticipant,
  adminUpdateParticipant,
  adminDeactivateParticipant,
  adminRevokeDetailedIntake,
  adminExportParticipantsCSV,
  adminApproveParticipant,
  adminApproveDetailedIntake,
  adminListInKindDonations,
  adminUpdateInKindDonationStatus,
  adminExportInKindDonationsCSV,
  adminGetInKindDonation,
  adminListVolunteers,
  adminGetVolunteer,
  adminUpdateVolunteerProfile,
  adminApproveVolunteer,
  adminUpdateSponsorProfile,
  adminListPartners,
  adminUpdatePartnerProfile,
  adminListOpportunities,
  adminGetPartner,
  adminGetOpportunity,
  adminCreateOpportunity,
  adminUpdateOpportunity,
  adminDeleteOpportunity,
  adminListSponsors,
  adminGetSponsor,
  adminDeactivateSponsor,
  adminDeleteSponsor,
  adminGetSettings,
  getSocialLinks,
  adminUpdateSettings,
  adminGetProfile,
  adminUpdateProfile,
  adminUpdatePassword,
  adminUploadAgreement,
  getAgreementHistory,
  viewAgreementPdf,
  adminDeletePartner,
  adminListBadges,
  adminGetBadge,
  adminCreateBadge,
  adminUpdateBadge,
  adminDeleteBadge,
  adminListMonetaryDonations,
  adminApproveMonetaryDonation,
  adminGetMonetaryDonation,
  adminListPartnerPickups,
  updateUserRole,
} = require('../controllers/adminController');

// PUBLIC-ISH route: PDF viewer with inline auth (opens in new tab, no Authorization header)
const jwt = require('jsonwebtoken');
const User = require('../models/User');
router.get('/settings/agreement/view', async (req, res, next) => {
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    req.user = user;
    viewAgreementPdf(req, res, next);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
});

// All routes below here require authentication
router.use(protect);

// Broad authorization: Admin and Moderator allowed by default
// Sensitive routes are restricted to 'admin' specifically below
router.use(authorize('admin', 'moderator'));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get Admin Dashboard Overview
 *     description: Returns all 6 stat cards, the recent activity feed (last 10 events), the active campaign goal widget, and optional campaign search results.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search campaigns by title (populates searchResults in response)
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalParticipants: { type: integer, example: 1284 }
 *                         totalVolunteers: { type: integer, example: 452 }
 *                         totalPartners: { type: integer, example: 87 }
 *                         pendingApprovals: { type: integer, example: 12 }
 *                         pendingDonations: { type: integer, example: 24 }
 *                         activeCampaigns: { type: integer, example: 8 }
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           type: { type: string, enum: [New Participant Intake, Volunteer Hours Logged, New In-Kind Donation, New Partner Registration] }
 *                           content: { type: string }
 *                           user:
 *                             type: object
 *                             properties:
 *                               _id: { type: string }
 *                               name: { type: string }
 *                               role: { type: string }
 *                           relatedId: { type: string }
 *                           relatedModel: { type: string }
 *                           createdAt: { type: string, format: date-time }
 *                     campaignGoal:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         _id: { type: string }
 *                         title: { type: string, example: "WINTER WARMTH DRIVE" }
 *                         goalAmount: { type: number, example: 20000 }
 *                         raisedAmount: { type: number, example: 14250 }
 *                         percentageReached: { type: integer, example: 71 }
 *                         daysRemaining: { type: integer, example: 8 }
 *                         imageUrl: { type: string }
 *                     searchResults:
 *                       type: array
 *                       description: Only present when ?search= query param is used
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           title: { type: string }
 *                           isActive: { type: boolean }
 *                           goalAmount: { type: number }
 *                           raisedAmount: { type: number }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – Admin role required }
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all system users
 *     description: Returns all registered users across all roles. Admin only.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuthResponse'
 */
router.get('/users', authorize('admin'), getAllUsers);
router.patch('/users/:id/role', authorize('admin'), updateUserRole);

/**
 * @swagger
 * /api/admin/partners/{id}/status:
 *   patch:
 *     summary: Update a partner organization's account status
 *     description: Admins can Approve (Active), Reject, Suspend, or mark as Expired. Approving (Active) will sync User.isApproved to true.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PartnerProfile document _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Pending, Expired, Suspended, Rejected]
 *     responses:
 *       200:
 *         description: Partner status updated and User.isApproved synced
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Partner profile not found
 */
/**
 * @swagger
 * /api/admin/community-partners:
 *   get:
 *     summary: List all organisational partners with agreement status
 *     description: Returns a paginated list of partners. Includes organization name, type, primary contact (user), agreement summary, and status.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by org name, user name, or Partner ID
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Active, Pending, Expired, Suspended, Rejected] }
 *     responses:
 *       200:
 *         description: List of partners retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       partnerId: { type: string }
 *                       orgName: { type: string }
 *                       orgType: { type: string }
 *                       status: { type: string }
 *                       userId:
 *                         type: object
 *                         properties:
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 */
router.get('/community-partners', adminListPartners);

router.patch('/partners/:id/status', updatePartnerStatus);

/**
 * @swagger
 * /api/admin/opportunities/{id}/status:
 *   patch:
 *     summary: Approve or reject a volunteer opportunity/event
 *     description: Admins review partner submissions before they go live. Triggers an ActivityLog entry automatically.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Opportunity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, rejected]
 *     responses:
 *       200:
 *         description: Status updated and activity log created
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Opportunity not found
 */
/**
 * @swagger
 * /api/admin/events:
 *   get:
 *     summary: List all volunteer opportunities (events)
 *     description: Returns a paginated list of opportunities with associated partner info.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of opportunities retrieved
 */
/**
 * @swagger
 * /api/admin/opportunities:
 *   get:
 *     summary: List all events/opportunities (Admin)
 *     tags: [Admin Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Draft, Confirmed, Pending, Completed, Cancelled, Rejected] }
 *     responses:
 *       200:
 *         description: List of events retrieved
 *   post:
 *     summary: Create a new event/opportunity (Admin)
 *     tags: [Admin Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, date]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               location: { type: string }
 *               date: { type: string, format: date }
 *               time: { type: string }
 *               endTime: { type: string }
 *               category: { type: string }
 *               requiredVolunteers: { type: integer }
 *               imageurl: { type: string }
 *               status: { type: string, enum: [Draft, Confirmed, Pending] }
 *     responses:
 *       201:
 *         description: Event created
 */
router.get('/events', adminListOpportunities);
router.post('/events', upload.single('flyer'), adminCreateOpportunity);
router.patch('/events/:id', upload.single('flyer'), adminUpdateOpportunity);
router.delete('/events/:id', adminDeleteOpportunity);
router.get('/events/:id', adminGetOpportunity);

/**
 * @swagger
 * /api/admin/community-partners/{id}:
 *   get:
 *     summary: Get full partner detail (Admin view)
 *     description: Returns the complete partner profile including legal information, company overview, onboarding score, and agreement history.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: PartnerProfile document _id
 *     responses:
 *       200:
 *         description: Full partner detail retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     partnerId: { type: string }
 *                     orgName: { type: string }
 *                     legalEntityName: { type: string }
 *                     registrationNumber: { type: string }
 *                     onboardingScore: { type: integer }
 *                     agreementHistory: { type: array }
 */
router.get('/community-partners/:id', adminGetPartner);
router.patch('/community-partners/:id', upload.single('logo'), adminUpdatePartnerProfile);
router.delete('/community-partners/:id', adminDeletePartner);

/**
 * @swagger
 * /api/admin/events/{id}:
 *   get:
 *     summary: Get single event detail
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event detail retrieved
 */
router.patch('/opportunities/:id/status', updateOpportunityStatus);

/**
 * @swagger
 * /api/admin/volunteer/add-hours/{id}:
 *   patch:
 *     summary: Manually add hours to a volunteer profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: VolunteerProfile document _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hours]
 *             properties:
 *               hours:
 *                 type: number
 *                 minimum: 0.1
 *                 example: 4.5
 *     responses:
 *       200:
 *         description: Hours added atomically; new total returned
 *       400:
 *         description: Invalid hours value
 *       404:
 *         description: Volunteer profile not found
 */
router.patch('/volunteer/add-hours/:id', addVolunteerHours);

/**
 * @swagger
 * /api/admin/volunteer/approve-hours/{logId}:
 *   patch:
 *     summary: Approve or reject pending volunteer hours
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *         description: VolunteerLog document _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status or log not found/already processed
 */
router.patch('/volunteer/approve-hours/:logId', adminApproveVolunteerHours);

/**
 * @swagger
 * /api/admin/finances:
 *   get:
 *     summary: Get financial overview & top sponsors
 *     description: Returns total raised from all sponsors, tier breakdown, and top 5 non-anonymous donors.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial overview retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRaised: { type: number }
 *                     sponsorCount: { type: integer }
 *                     tierBreakdown:
 *                       type: object
 *                       properties:
 *                         Gold: { type: integer }
 *                         Silver: { type: integer }
 *                         Bronze: { type: integer }
 *                         Supporter: { type: integer }
 *                     topSponsors:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/finances', authorize('admin'), getFinances);

/**
 * @swagger
 * /api/admin/participants/summary:
 *   get:
 *     summary: Get participant summary (privacy-masked names)
 *     description: Returns all participant accounts with names masked as "First L." for privacy.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Participant list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string, example: "Jordan S." }
 *                       email: { type: string }
 *                       role: { type: string }
 *                       createdAt: { type: string, format: date-time }
 */
router.get('/participants/summary', getParticipantSummary);

/**
 * @swagger
 * /api/admin/participants:
 *   get:
 *     summary: List participants with pagination, search, and filters
 *     description: Returns a paginated list of participants. Supports search by name/email, filter by accountStatus and housingStatus. Used for the Participants table view.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, STABLE, "IN PROGRESS", URGENT, INACTIVE] }
 *       - in: query
 *         name: housingStatus
 *         schema: { type: string, enum: [Housed, Unhoused, Shelter, "Transitional Housing", "At Risk of Homelessness", Waitlisted, Placed, Emergency, Searching] }
 *     responses:
 *       200:
 *         description: Paginated participant list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pages: { type: integer }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       participantId: { type: string, example: "#88291" }
 *                       housingStatus: { type: string }
 *                       accountStatus: { type: string, enum: [ACTIVE, STABLE, "IN PROGRESS", URGENT, INACTIVE] }
 *                       address:
 *                         type: object
 *                         properties:
 *                           city: { type: string }
 *                       intakeStatus:
 *                         type: object
 *                         properties:
 *                           percentage: { type: integer }
 *                           status: { type: string }
 *                       userId:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 */
router.get('/participants', adminListParticipants);

/**
 * @swagger
 * /api/admin/participants/export:
 *   get:
 *     summary: Export all participants as CSV
 *     description: Downloads a CSV file with all participant records. Includes name, email, housing status, city, account status, demographics, and registration date.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/participants/export', adminExportParticipantsCSV);

/**
 * @swagger
 * /api/admin/participants/{id}:
 *   get:
 *     summary: Get full participant detail (Admin view)
 *     description: Returns the complete participant profile including Basic Info, Current Residence, Demographics, Documents, and Vouchers. Used for the Participant Detail screen.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ParticipantProfile document _id
 *     responses:
 *       200:
 *         description: Full participant detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     participantId: { type: string, example: "#88291" }
 *                     accountStatus: { type: string }
 *                     housingStatus: { type: string }
 *                     address: { type: object }
 *                     gender: { type: string }
 *                     raceEthnicity: { type: string, example: "Caucasian / Non-Hispanic" }
 *                     primaryLanguage: { type: string, example: "English" }
 *                     annualIncome: { type: string, example: "50000" }
 *                     isVeteran: { type: boolean }
 *                     hasDisability: { type: boolean }
 *                     documents: { type: array }
 *                     intakeStatus: { type: object }
 *                     userId:
 *                       type: object
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                         phone: { type: string }
 *                         profilePictureUrl: { type: string }
 *                         createdAt: { type: string, format: date-time }
 *       404:
 *         description: Participant not found
 *   patch:
 *     summary: Edit participant profile fields (Admin)
 *     description: Allows admin to update any participant profile field (demographics, housing, status, etc.).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               housingStatus: { type: string }
 *               accountStatus: { type: string, enum: [ACTIVE, STABLE, "IN PROGRESS", URGENT, INACTIVE] }
 *               gender: { type: string, enum: [Male, Female, Non-Binary, "Prefer not to say"] }
 *               raceEthnicity: { type: string }
 *               primaryLanguage: { type: string }
 *               annualIncome: { type: string }
 *               isVeteran: { type: boolean }
 *               hasDisability: { type: boolean }
 *               address: { type: object }
 *     responses:
 *       200:
 *         description: Profile updated
 *       404:
 *         description: Participant not found
 */
router.get('/participants/:id', adminGetParticipant);
router.patch('/participants/:id', adminUpdateParticipant);

/**
 * @swagger
 * /api/admin/participants/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a participant account
 *     description: Sets the participant's accountStatus to INACTIVE. Corresponds to the "Deactivate" button on the Participant Detail screen.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Participant deactivated
 *       404:
 *         description: Participant not found
 */
router.patch('/participants/:id/deactivate', adminDeactivateParticipant);
router.patch('/participants/:id/approve', adminApproveParticipant);
router.patch('/participants/:id/approve-detailed', adminApproveDetailedIntake);
router.patch('/participants/:id/revoke-detailed', adminRevokeDetailedIntake);

/**
 * @swagger
 * /api/admin/in-kind-donations:
 *   get:
 *     summary: List all in-kind donations with stats and pagination
 *     description: Returns a paginated list of all in-kind donations along with 3 dashboard stat counts (Pending Review, Approved This Week, Scheduled Pickups Today).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated donations list and stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     pendingReviewCount: { type: integer }
 *                     approvedThisWeekCount: { type: integer }
 *                     scheduledPickupsTodayCount: { type: integer }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pages: { type: integer }
 *                     count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       refId: { type: string }
 *                       itemName: { type: string }
 *                       itemCategory: { type: string }
 *                       quantity: { type: string }
 *                       deliveryMethod: { type: string }
 *                       locationName: { type: string }
 *                       storageDetails: { type: object }
 *                       status: { type: string }
 *                       petInfo: { type: object }
 *                       donorId:
 *                         type: object
 *                         properties:
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 */
router.get('/in-kind-donations', adminListInKindDonations);
router.get('/partner-pickups', adminListPartnerPickups);

/**
 * @swagger
 * /api/admin/in-kind-donations/export:
 *   get:
 *     summary: Export in-kind donations as CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/in-kind-donations/export', adminExportInKindDonationsCSV);

/**
 * @swagger
 * /api/admin/in-kind-donations/{id}:
 *   get:
 *     summary: Get full In-Kind Donation detail (Admin view)
 *     description: Returns the complete donation record including donor details, item info, pet exposure, and destination assignment. Used for the Donation Detail screen.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full donation detail
 *       404:
 *         description: Donation not found
 */
router.get('/in-kind-donations/:id', adminGetInKindDonation);

/**
 * @swagger
 * /api/admin/in-kind-donations/{id}/status:
 *   patch:
 *     summary: Update an In-Kind Donation status
 *     description: Allows admin to approve, schedule, complete, or reject a donation. Also supports setting storage details (room, rack, shelf, floor) and Destination (locationName).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, approved, scheduled, completed, rejected] }
 *               rejectionReason: { type: string }
 *               locationName: { type: string, description: "Destination, e.g. Main Shelter" }
 *               storageRoom: { type: string }
 *               storageRack: { type: string }
 *               storageShelf: { type: string }
 *               storageFloor: { type: string }
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status 
 *       404:
 *         description: Donation not found
 */
router.patch('/in-kind-donations/:id/status', adminUpdateInKindDonationStatus);

router.get('/volunteers', adminListVolunteers);
router.get('/volunteers/:id', adminGetVolunteer);
router.patch('/volunteers/:id', adminUpdateVolunteerProfile);
router.patch('/volunteers/:id/approve', adminApproveVolunteer);

/**
 * @swagger
 * /api/admin/sponsors/{id}:
 *   patch:
 *     summary: Update sponsor profile (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName: { type: string }
 *               tier: { type: string, enum: [Supporter, Bronze, Silver, Gold] }
 *               totalContributed: { type: number }
 *     responses:
 *       200:
 *         description: Profile updated.
 *       404:
 *         description: Profile not found.
 */
router.get('/sponsors', authorize('admin'), adminListSponsors);
router.get('/sponsors/:id', authorize('admin'), adminGetSponsor);
router.patch('/sponsors/:id/deactivate', authorize('admin'), adminDeactivateSponsor);
router.patch('/sponsors/:id', authorize('admin'), adminUpdateSponsorProfile);
router.delete('/sponsors/:id', authorize('admin'), adminDeleteSponsor);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get system-wide settings
 *     description: Returns links for donation, membership, admin emails, and agreement versioning.
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved
 *   patch:
 *     summary: Update system-wide settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primaryAdminEmail: { type: string }
 *               secondaryAdminEmail: { type: string }
 *               zeffyDonationLink: { type: string }
 *               zeffyMembershipLink: { type: string }
 *               activeAgreementVersion: { type: string }
 *     responses:
 *       200:
 *         description: Settings updated
 *
 * /api/admin/settings/social-links:
 *   get:
 *     summary: Get social media links
 *     description: Returns social media links from system settings. Public endpoint for frontend display.
 *     tags: [Admin Settings]
 *     responses:
 *       200:
 *         description: Social links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     facebook: { type: string, example: "https://facebook.com/ourhive" }
 *                     instagram: { type: string, example: "https://instagram.com/ourhive" }
 *                     twitter: { type: string, example: "https://twitter.com/ourhive" }
 *                     linkedin: { type: string, example: "https://linkedin.com/company/ourhive" }
 *                     youtube: { type: string, example: "https://youtube.com/@ourhive" }
 *                     tiktok: { type: string, example: "https://tiktok.com/@ourhive" }
 */
router.get('/settings', authorize('admin'), adminGetSettings);
router.get('/settings/social-links', authorize('admin'), getSocialLinks);
router.patch('/settings', authorize('admin'), adminUpdateSettings);

/**
 * @swagger
 * /api/admin/settings/agreement:
 *   post:
 *     summary: Upload a new volunteer agreement (PDF)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               agreement:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Agreement uploaded
 */
router.post('/settings/agreement', authorize('admin'), upload.single('agreement'), adminUploadAgreement);


router.get('/settings/agreement/history', getAgreementHistory);

/**
 * @swagger
 * /api/admin/profile:
 *   get:
 *     summary: Get current admin profile
 *     tags: [Admin Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *   patch:
 *     summary: Update admin profile information
 *     tags: [Admin Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get('/profile', adminGetProfile);
router.patch('/profile', upload.single('profilePicture'), adminUpdateProfile);

/**
 * @swagger
 * /api/admin/profile/password:
 *   patch:
 *     summary: Update admin password
 *     tags: [Admin Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password updated
 */
router.patch('/profile/password', adminUpdatePassword);

/**
 * @swagger
 * /api/admin/sponsors:
 *   get:
 *     summary: List all sponsors with pagination, search, and stats
 *     description: Returns a paginated list of sponsors. Supports search by organization name/user name and status filter. Includes header stats (Annual Contributions, In-Kind Valuation, Total Active Partners).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Active, Inactive] }
 *     responses:
 *       200:
 *         description: Paginated sponsor list and stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     annualContributions: { type: number }
 *                     inKindValuation: { type: number }
 *                     totalActivePartners: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       organizationName: { type: string }
 *                       totalContributed: { type: number }
 *                       tier: { type: string }
 *                       status: { type: string }
 *                       userId:
 *                         type: object
 *                         properties:
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 */
router.get('/sponsors', authorize('admin'), adminListSponsors);

/**
 * @swagger
 * /api/admin/sponsors/{id}:
 *   get:
 *     summary: Get full sponsor detail with donation history
 *     description: Returns the complete sponsor profile and their monetary donation history.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full sponsor detail and history
 */
router.get('/sponsors/:id', authorize('admin'), adminGetSponsor);

/**
 * @swagger
 * /api/admin/sponsors/{id}/deactivate:
 *   patch:
 *     summary: Deactivate or Activate a sponsor account
 *     description: Toggles the sponsor status between Active and Inactive.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sponsor status updated
 */
router.patch('/sponsors/:id/deactivate', authorize('admin'), adminDeactivateSponsor);

/**
 * @swagger
 * /api/admin/donations/monetary:
 *   get:
 *     summary: List all monetary donations (Pledges)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, completed] }
 */
router.get('/donations/monetary', authorize('admin'), adminListMonetaryDonations);

/**
 * @swagger
 * /api/admin/donations/monetary/{id}/approve:
 *   patch:
 *     summary: Approve a monetary donation pledge
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/donations/monetary/:id/approve', authorize('admin'), adminApproveMonetaryDonation);

/**
 * @swagger
 * /api/admin/donations/monetary/{id}:
 *   get:
 *     summary: Get single monetary donation detail
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/donations/monetary/:id', authorize('admin'), adminGetMonetaryDonation);

/**
 * @swagger
 * /api/admin/badges:
 *   get:
 *     summary: List all badges
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of badges retrieved
 *   post:
 *     summary: Create a new badge
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Badge created
 */
router.get('/badges', adminListBadges);
router.post('/badges', upload.single('badgeImage'), adminCreateBadge);

/**
 * @swagger
 * /api/admin/badges/{id}:
 *   get:
 *     summary: Get single badge detail
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Badge detail retrieved
 *   patch:
 *     summary: Update a badge
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badge updated
 *   delete:
 *     summary: Delete a badge
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badge deleted
 */
router.get('/badges/:id', adminGetBadge);
router.patch('/badges/:id', upload.single('badgeImage'), adminUpdateBadge);
router.delete('/badges/:id', adminDeleteBadge);

module.exports = router;
