const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const {
  submitProfile,
  getMyProfile,
  updateProfile,
  getDashboardData,
  createOpportunity,
  updateOpportunity,
  getMyOpportunities,
} = require('../controllers/partnerController');

// All partner profile routes require auth + partner role
router.use(protect);
router.use(authorize('partner'));

/**
 * @swagger
 * /api/partners/profile:
 *   post:
 *     summary: Submit or update partner organization profile
 *     description: >
 *       A partner submits their organization details and agreement confirmations.
 *       This endpoint uses **upsert** logic — re-submitting will update the existing profile.
 *       Profile status starts as `pending` until an admin approves.
 *       Contact person's name (firstName, lastName, or fullName) is also saved to the User record.
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - orgName
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full contact name stored in profile (optional duplicate of User info).
 *                 example: "Johnathan A. Doe"
 *               fullName:
 *                 type: string
 *                 description: Full name of the contact person. Will be split into firstName and lastName when provided with names.
 *                 example: "John Smith"
 *               firstName:
 *                 type: string
 *                 description: First name of the contact person
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Last name of the contact person
 *                 example: Smith
 *               orgName:
 *                 type: string
 *                 example: Acme Community Foundation
 *               orgType:
 *                 type: string
 *                 example: Non-Profit Organization
 *               address:
 *                 type: string
 *                 example: 123 Main St, Karachi, Pakistan
 *               website:
 *                 type: string
 *                 example: 'https://acme.org'
 *               organizationLogo:
 *                 type: string
 *                 format: binary
 *               intendedRoles:
 *                 type: string
 *                 description: JSON string or comma-separated roles.
 *               agreements:
 *                 type: string
 *                 description: JSON string of agreements object.
 *     responses:
 *       200:
 *         description: Profile submitted successfully. Awaiting admin review.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerProfileResponse'
 *       400:
 *         description: Validation error (e.g., missing orgName).
 */
router.post('/profile', upload.single('organizationLogo'), submitProfile);

/**
 * @swagger
 * /api/partners/my-profile:
 *   get:
 *     summary: Get logged-in partner's own profile
 *     tags: [Partners]
 *     responses:
 *       200:
 *         description: Partner profile with event statistics (includes contact fullName)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: object
 *                       properties:
 *                         contactName: { type: string, example: "Johnathan A. Doe" }
 *                         // original PartnerProfile fields
 *                         userId:
 *                           type: object
 *                           properties:
 *                             firstName: { type: string }
 *                             lastName: { type: string }
 *                             fullName: { type: string }
 *                             email: { type: string }
 *                       $ref: '#/components/schemas/PartnerProfile'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalEvents: { type: integer, example: 5 }
 *                         pendingEvents: { type: integer, example: 2 }
 *                         totalVolunteers: { type: integer, example: 34 }
 *   patch:
 *     summary: Update logged-in partner's profile
 *     description: Update partner organization profile information and contact person's name. All fields are optional - only provided fields will be updated.
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Full name of the contact person (e.g. "John Smith"). Will be split into firstName and lastName.
 *                 example: "John Smith"
 *               firstName:
 *                 type: string
 *                 description: First name of the contact person
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Last name of the contact person
 *                 example: Smith
 *               orgName:
 *                 type: string
 *                 example: Acme Community Foundation
 *               orgType:
 *                 type: string
 *                 example: Non-Profit Organization
 *               address:
 *                 type: string
 *                 example: 123 Main St, Karachi, Pakistan
 *               website:
 *                 type: string
 *                 example: 'https://acme.org'
 *               organizationLogo:
 *                 type: string
 *                 format: binary
 *               intendedRoles:
 *                 type: string
 *                 description: JSON string or comma-separated roles.
 *               agreements:
 *                 type: string
 *                 description: JSON string of agreements object.
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PartnerProfile' }
 *       404:
 *         description: Partner profile not found.
 */
router.get('/my-profile', getMyProfile);
router.patch('/my-profile', upload.single('organizationLogo'), updateProfile);

/**
 * @swagger
 * /api/partners/dashboard:
 *   get:
 *     summary: Get partner dashboard overview
 *     tags: [Partners]
 */
router.get('/dashboard', getDashboardData);

/**
 * @swagger
 * /api/partners/opportunities:
 *   post:
 *     summary: Create a new volunteer opportunity or event (Partner only)
 *     tags: [Partners, Opportunities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               location: { type: string }
 *               date: { type: string, format: date-time }
 *               time: { type: string }
 *               endTime: { type: string }
 *               category: { type: string }
 *               requiredVolunteers: { type: integer }
 *               type: { type: string, enum: [event, opportunity] }
 *               flyer: { type: string, format: binary }
 *               impactStatement: { type: string }
 *               physicalRequirements: { type: string }
 *               dressCode: { type: string }
 *               orientation: { type: string }
 */
router.post('/opportunities', upload.single('flyer'), createOpportunity);

/**
 * @swagger
 * /api/partners/opportunities/partner:
 *   get:
 *     summary: Get all opportunities created by the logged-in partner
 *     description: Retrieve list of events and volunteer opportunities. Supports optional search and status filtering.
 *     tags: [Partners, Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, rejected, completed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search within title or description
 *     responses:
 *       200:
 *         description: List of opportunities retrieved.
 */
router.get('/opportunities/partner', getMyOpportunities);

/**
 * @swagger
 * /api/partners/opportunities/{id}:
 *   patch:
 *     summary: Update an existing opportunity (Partner only)
 *     description: Allows partners to edit their submissions. Status will revert to 'pending' after edit.
 *     tags: [Partners, Opportunities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               flyer: { type: string, format: binary }
 *               # ... other fields
 */
router.patch('/opportunities/:id', upload.single('imageurl'), updateOpportunity);

module.exports = router;
