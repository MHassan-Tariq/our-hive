const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const { 
  saveProfile, 
  getParticipantProfile,
  getMyFeed, 
  requestService,
  getParticipantDashboard,
  submitIntakeStep,
  uploadDocument,
  sendVerificationCode,
  verifyCode,
  getPantries
} = require('../controllers/participantController');

router.use(protect);
router.use(authorize('participant'));

/**
 * @swagger
 * /api/participant/profile:
 *   post:
 *     summary: Save or update participant profile
 *     description: Saves participant interests and residence area.
 *     tags: [Participants]
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
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Food Security", "Health"]
 *               residenceArea:
 *                 type: string
 *                 example: "Clifton, Karachi"
 *               housingStatus:
 *                 type: string
 *                 enum: ['Housed', 'Unhoused', 'Shelter', 'Transitional Housing', 'At Risk of Homelessness']
 *               address:
 *                 type: object
 *                 properties:
 *                   street: { type: string }
 *                   unit: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   zipCode: { type: string }
 *               unhousedDetails:
 *                 type: object
 *                 properties:
 *                   crossStreets: { type: string }
 *                   nearbyBusiness: { type: string }
 *                   landmark: { type: string }
 *                   city: { type: string }
 *                   zipCode: { type: string }
 *               householdSize: { type: integer, example: 4 }
 *               childrenCount: { type: integer, example: 2 }
 *               seniorsCount: { type: integer, example: 0 }
 *               petsCount: { type: integer, example: 1 }
 *               dietaryRestrictions: { type: array, items: { type: string, enum: ['Gluten-Free', 'Vegetarian', 'Vegan', 'Halal', 'Other'] } }
 *               isVeteran: { type: boolean }
 *               hasDisability: { type: boolean }
 *               monthlyIncome: { type: number, example: 2500 }
 *               citizenStatus: { type: string, enum: ['Yes', 'No', 'Prefer not to say'] }
 *               assistancePrograms: { type: array, items: { type: string, enum: ['CalFresh', 'Medi-Cal', 'SSI', 'Other'] } }
 *               consentToInformationUse: { type: boolean }
 *     responses:
 *       200:
 *         description: Profile saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 */
router.post('/profile', saveProfile);

/**
 * @swagger
 * /api/participant/profile:
 *   get:
 *     summary: Get full participant profile
 *     description: Returns the unified user and participant profile data mapped for the frontend.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     personalInfo:
 *                       type: object
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                         phone: { type: string }
 *                         profilePictureUrl: { type: string }
 *                     participantId: { type: string }
 *                     householdDetails:
 *                       type: object
 *                       properties:
 *                         householdSize: { type: integer }
 *                         childrenCount: { type: integer }
 *                         seniorsCount: { type: integer }
 *                         petsCount: { type: integer }
 *                     address: { type: object }
 *                     unhousedDetails: { type: object }
 *                     housingStatus: { type: string }
 *                     documents: { type: array }
 *                     intakeStatus: { type: object }
 *                     interests: { type: array, items: { type: string } }
 *                     dietaryRestrictions: { type: array, items: { type: string } }
 *                     isVeteran: { type: boolean }
 *                     hasDisability: { type: boolean }
 *                     monthlyIncome: { type: number }
 *                     citizenStatus: { type: string }
 *                     assistancePrograms: { type: array, items: { type: string } }
 *                     consentToInformationUse: { type: boolean }
 */
router.get('/profile', getParticipantProfile);

/**
 * @swagger
 * /api/participant/my-feed:
 *   get:
 *     summary: Get personalized feed of opportunities and donations
 *     description: Returns a curated list of active opportunities and available donations matching the participant's interests or area.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized feed retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/Opportunity'
 *                       - $ref: '#/components/schemas/InKindDonation'
 */
router.get('/my-feed', getMyFeed);

/**
 * @swagger
 * /api/participant/request-service/{id}:
 *   post:
 *     summary: Request a service/item and generate a digital voucher
 *     description: Generates a secure QR-ready voucher for the participant to claim an item or service.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service or Donation ID
 *     responses:
 *       201:
 *         description: Voucher generated successfully.
 */
router.post('/request-service/:id', requestService);

/**
 * @swagger
 * /api/participant/dashboard:
 *   get:
 *     summary: Get Participant Dashboard Overview
 *     description: Unified endpoint for greeting, intake status, and community updates.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                     intakeStatus: { type: object }
 *                     communityUpdates: { type: array, items: { type: object } }
 *                     nextDistribution:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: string }
 *                         title: { type: string }
 *                         date: { type: string, format: date-time }
 *                         time: { type: string }
 *                         endTime: { type: string }
 *                         location: { type: string }
 *                         specificLocation: { type: string }
 *                     documentsStatus:
 *                       type: object
 *                       properties:
 *                         missingCount: { type: integer }
 */
router.get('/dashboard', getParticipantDashboard);

/**
 * @swagger
 * /api/participant/intake-step:
 *   patch:
 *     summary: Update intake progress step
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               step: { type: integer, example: 2 }
 *               data:
 *                 type: object
 *                 description: Optional profile updates to save with the step
 *                 properties:
 *                   interests: { type: array, items: { type: string } }
  *                   housingStatus: { type: string }
 *                   address: { type: object }
 *                   unhousedDetails: { type: object }
 *                   householdSize: { type: integer }
 *                   dietaryRestrictions: { type: array, items: { type: string } }
 *                   isVeteran: { type: boolean }
 *                   hasDisability: { type: boolean }
 *                   monthlyIncome: { type: number }
 *                   citizenStatus: { type: string }
 *                   assistancePrograms: { type: array, items: { type: string } }
 *                   consentToInformationUse: { type: boolean }
 *     responses:
 *       200:
 *         description: Intake step updated.
 */
router.patch('/intake-step', submitIntakeStep);

/**
 * @swagger
 * /api/participant/upload-document:
 *   post:
 *     summary: Upload compliance document (ID/Proof)
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - documentType
 *               - document
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [ID, Proof of Residence, Proof of Income]
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document uploaded successfully.
 */
router.post('/upload-document', upload.single('document'), uploadDocument);

/**
 * @swagger
 * /api/participant/send-verification-code:
 *   post:
 *     summary: Request email verification code (OTP)
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Code sent successfully.
 */
router.post('/send-verification-code', sendVerificationCode);

/**
 * @swagger
 * /api/participant/verify-code:
 *   post:
 *     summary: Verify email OTP code
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified successfully.
 *       400:
 *         description: Invalid or expired code.
 */
router.post('/verify-code', verifyCode);

/**
 * @swagger
 * /api/participant/pantries:
 *   get:
 *     summary: Get a searchable list of active pantries/opportunities
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Optional search term for title, location, or category
 *     responses:
 *       200:
 *         description: List of pantries retrieved successfully.
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
 *                       id: { type: string }
 *                       title: { type: string }
 *                       location: { type: string }
 *                       specificLocation: { type: string }
 *                       coordinates:
 *                         type: object
 *                         properties:
 *                           lat: { type: number, example: 39.7817 }
 *                           lng: { type: number, example: -89.6501 }
 *                       category: { type: string }
 *                       operatingStatus: { type: string, example: "Open until 4:00 PM" }
 *                       distance: { type: string, example: "0.5 Min" }
 *                       date: { type: string, format: date-time }
 *                       time: { type: string }
 *                       endTime: { type: string }
 */
router.get('/pantries', getPantries);

module.exports = router;
