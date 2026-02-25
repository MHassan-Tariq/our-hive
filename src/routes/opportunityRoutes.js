const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  createOpportunity,
  getMyOpportunities,
} = require('../controllers/partnerController');
const {
  getAvailableOpportunities,
  joinOpportunity,
} = require('../controllers/volunteerController');
const {
  getUpcomingEvents,
  joinEvent,
  getMyRegisteredEvents,
  getEventDetails,
  checkInToEvent,
} = require('../controllers/opportunityController');

router.use(protect);

/**
 * @swagger
 * /api/opportunities/upcoming:
 *   get:
 *     summary: Get all upcoming events (Generic access)
 *     tags: [Opportunities]
 *     responses:
 *       200:
 *         description: List of upcoming active events.
 */
router.get('/upcoming', getUpcomingEvents);

/**
 * @swagger
 * /api/opportunities/my-registered:
 *   get:
 *     summary: Get my registered events (Generic access)
 *     tags: [Opportunities]
 *     responses:
 *       200:
 *         description: List of joined events.
 */
router.get('/my-registered', getMyRegisteredEvents);

/**
 * @swagger
 * /api/opportunities/{id}/join:
 *   post:
 *     summary: Join an event (Any role)
 *     tags: [Opportunities]
 */
router.post('/:id/join', joinEvent);

/**
 * @swagger
 * /api/opportunities/{id}:
 *   get:
 *     summary: Get specific event details (Page 6 alignment)
 *     tags: [Opportunities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details including description, location, time, organization data (via partnerId), and whatToBring.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     title: { type: string }
 *                     date: { type: string, format: date-time }
 *                     time: { type: string }
 *                     endTime: { type: string }
 *                     partnerId:
 *                       type: object
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                         profilePictureUrl: { type: string }
 *                     location: { type: string }
 *                     specificLocation: { type: string }
 *                     coordinates:
 *                       type: object
 *                       properties:
 *                         lat: { type: number, example: 39.7817 }
 *                         lng: { type: number, example: -89.6501 }
 *                     description: { type: string, description: "Corresponds to 'About Event' in UI" }
 *                     whatToBring:
 *                       type: array
 *                       items: { type: string }
 *                       description: "Checklist of items to bring"
 */
router.get('/:id', getEventDetails);
/**
 * @swagger
 * /api/opportunities:
 *   post:
 *     summary: Create a new volunteer opportunity (Approved Partners only)
 *     description: >
 *       Allows an **approved** partner to post a new opportunity for volunteers.
 *       Returns `403 Forbidden` if the partner's profile status is still `pending` or `rejected`.
 *     tags: [Opportunities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: Weekend Food Drive
 *               description:
 *                 type: string
 *                 example: Help sort and distribute donated food to local families in Karachi.
 *               location:
 *                 type: string
 *                 example: Clifton Community Center, Karachi
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-15T09:00:00.000Z"
 *               time: { type: string }
 *               endTime: { type: string }
 *               category:
 *                 type: string
 *                 example: Food Security
 *               requiredVolunteers:
 *                 type: integer
 *                 minimum: 1
 *                 example: 15
 *               impactStatement: { type: string }
 *               physicalRequirements: { type: string }
 *               dressCode: { type: string }
 *               orientation: { type: string }
 *               flyer:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Opportunity created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityResponse'
 *       400:
 *         description: Validation error (e.g., missing title or description).
 */
router.post('/', authorize('partner'), upload.single('flyer'), createOpportunity);

/**
 * @swagger
 * /api/opportunities/partner:
 *   get:
 *     summary: Get all opportunities created by the logged-in partner
 *     description: Returns a list of all opportunities this partner has posted, sorted newest first.
 *     tags: [Opportunities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of partner's opportunities.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Opportunity'
 *       401:
 *         description: Unauthorized — no or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a partner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/partner', protect, authorize('partner'), getMyOpportunities);

/**
 * @swagger
 * /api/opportunities/available:
 *   get:
 *     summary: Get all available opportunities (Volunteers only)
 *     description: >
 *       Returns all opportunities where `status` is `active` **AND** the number
 *       of attendees is less than `requiredVolunteers`. Full events are automatically
 *       filtered out at the database level. Results include `spotsLeft` and `attendeeCount`
 *       virtual fields for the frontend to display capacity information.
 *     tags: [Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title or description
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (e.g., Food Security, Education)
 *     responses:
 *       200:
 *         description: List of available (not full) active opportunities.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Opportunity'
 *                       - type: object
 *                         properties:
 *                           spotsLeft:
 *                             type: integer
 *                             example: 8
 *                             description: Remaining spots (requiredVolunteers - attendees.length)
 *                           attendeeCount:
 *                             type: integer
 *                             example: 7
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a volunteer.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/available',
  protect,
  authorize('volunteer'),
  getAvailableOpportunities
);

/**
 * @swagger
 * /api/opportunities/{id}/join:
 *   post:
 *     summary: Join an opportunity (claim a volunteer spot)
 *     description: >
 *       Allows a volunteer to claim a spot in an active opportunity.
 *       The backend enforces four rules in order:
 *       1. Opportunity must exist
 *       2. Opportunity must be `active`
 *       3. Volunteer has not already joined
 *       4. Capacity has not been reached (`attendees.length < requiredVolunteers`)
 *
 *       On success, the volunteer is added to `Opportunity.attendees` and
 *       the opportunity ID is added to the volunteer's `joinedOpportunities` list.
 *     tags: [Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Opportunity `_id` to join
 *         example: 64opp123abc789
 *     responses:
 *       200:
 *         description: Successfully joined the opportunity.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "You have successfully joined \"Weekend Food Drive\"."
 *                 data:
 *                   type: object
 *                   properties:
 *                     opportunityId:
 *                       type: string
 *                       example: 64opp123abc789
 *                     title:
 *                       type: string
 *                       example: Weekend Food Drive
 *                     date:
 *                       type: string
 *                       format: date-time
 *                     time:
 *                       type: string
 *                     endTime:
 *                       type: string
 *                     location:
 *                       type: string
 *                     spotsLeft:
 *                       type: integer
 *                       example: 7
 *                     attendeeCount:
 *                       type: integer
 *                       example: 8
 *       400:
 *         description: Business rule violation (already joined, or opportunity is full / not active).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               already_joined:
 *                 summary: Volunteer already joined this opportunity
 *                 value:
 *                   success: false
 *                   message: "You have already joined this opportunity."
 *               opportunity_full:
 *                 summary: No spots remaining
 *                 value:
 *                   success: false
 *                   message: "Opportunity is full."
 *               not_active:
 *                 summary: Opportunity is no longer active
 *                 value:
 *                   success: false
 *                   message: "This opportunity is no longer active (status: completed)."
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not a volunteer.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Opportunity not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/join',
  protect,
  authorize('volunteer'),
  joinOpportunity
);

/**
 * @swagger
 * /api/opportunities/{id}/check-in:
 *   post:
 *     summary: Check-in to an opportunity (Record physical arrival)
 *     description: >
 *       Records a participant's physical arrival at the location.
 *       They will be added to the `checkedInUsers` list. If they hadn't previously
 *       RSVP'd (joined), they are also added to the `attendees` list as a walk-in.
 *       Generates an ActivityLog for the hosting partner.
 *     tags: [Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Opportunity `_id` to check into
 *     responses:
 *       200:
 *         description: Successfully checked in ("You Have Arrived!").
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'You have arrived! Successfully checked in to "Weekend Food Drive".' }
 *                 data:
 *                   $ref: '#/components/schemas/Opportunity'
 *       400:
 *         description: Already checked in or opportunity not active.
 *       404:
 *         description: Opportunity not found.
 */
router.post(
  '/:id/check-in',
  protect,
  checkInToEvent
);

module.exports = router;

