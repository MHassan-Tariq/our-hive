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
  getPantries,
  completeIntakeSubmission

} = require('../controllers/participantController');

router.use(protect);
router.use(authorize('participant'));

/**
 * @swagger
 * /api/participant/profile:
 *   post:
 *     summary: Save or update comprehensive participant profile
 *     description: Updates all participant information including personal, address, household, income, documents, and assistance programs.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: "Jane" }
 *               lastName: { type: string, example: "Doe" }
 *               email: { type: string, example: "jane@example.com" }
 *               phone: { type: string, example: "(555) 123-4567" }
 *               dateOfBirth: { type: string, format: date, example: "1990-05-15" }
 *               gender: { type: string, enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say'] }
 *               race: { type: string, example: "African American" }
 *               ethnicity: { type: string, example: "Hispanic" }
 *               street: { type: string, example: "123 Main St" }
 *               unit: { type: string, example: "Apt 4B" }
 *               city: { type: string, example: "Los Angeles" }
 *               state: { type: string, example: "CA" }
 *               zipCode: { type: string, example: "90210" }
 *               householdSize: { type: integer, example: 4 }
 *               childrenCount: { type: integer, example: 2 }
 *               seniorsCount: { type: integer, example: 0 }
 *               petsCount: { type: integer, example: 1 }
 *               isVeteran: { type: boolean, example: false }
 *               hasDisability: { type: boolean, example: false }
 *               monthlyIncome: { type: number, example: 2500 }
 *               housingStatus: { type: string, enum: ['Housed', 'Unhoused', 'Shelter', 'Transitional Housing', 'At Risk of Homelessness'] }
 *               assistancePrograms: { type: array, items: { type: string }, example: ["CalFresh", "Medi-Cal"] }
 *               dietaryRestrictions: { type: array, items: { type: string }, example: ["Vegetarian"] }
 *               citizenStatus: { type: string, enum: ['Yes', 'No', 'Prefer not to say'] }
 *               consentToInformationUse: { type: boolean }
 *               isIntakeApproved: { type: boolean, example: true }
 *               documents: { type: array, items: { type: string, format: binary }, description: "Up to 2 document files" }
 *               documentType_0: { type: string, enum: ['ID', 'Proof of Residence', 'Proof of Income'], description: "Type of first document" }
 *               documentType_1: { type: string, enum: ['ID', 'Proof of Residence', 'Proof of Income'], description: "Type of second document" }
 *     responses:
 *       200:
 *         description: Profile saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { type: object }
 */
router.post('/profile', upload.array('documents', 2), saveProfile);

/**
 * @swagger
 * /api/participant/profile:
 *   get:
 *     summary: Get full participant profile
 *     description: Returns the unified user and participant profile data including personal, address, household, income, and documents.
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
 *                         dateOfBirth: { type: string, format: date }
 *                         gender: { type: string }
 *                         race: { type: string }
 *                         ethnicity: { type: string }
 *                         profilePictureUrl: { type: string }
 *                     participantId: { type: string }
 *                     addressInfo:
 *                       type: object
 *                       properties:
 *                         street: { type: string }
 *                         unit: { type: string }
 *                         city: { type: string }
 *                         state: { type: string }
 *                         zipCode: { type: string }
 *                     householdDetails:
 *                       type: object
 *                       properties:
 *                         householdSize: { type: integer }
 *                         childrenCount: { type: integer }
 *                         seniorsCount: { type: integer }
 *                         petsCount: { type: integer }
 *                         veteranStatus: { type: boolean }
 *                         disability: { type: boolean }
 *                     incomeAndHousing:
 *                       type: object
 *                       properties:
 *                         annualIncome: { type: number }
 *                         housingStatus: { type: string }
 *                     unhousedDetails: { type: object }
 *                     documents: { type: array }
 *                     assistancePrograms: { type: array, items: { type: string } }
 *                     intakeStatus: { type: object }
 *                     interests: { type: array, items: { type: string } }
 *                     dietaryRestrictions: { type: array, items: { type: string } }
 *                     citizenStatus: { type: string }
 *                     consentToInformationUse: { type: boolean }
 *                     isIntakeApproved: { type: boolean }
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
 * /api/participant/complete-intake:
 *   post:
 *     summary: Complete entire intake form in one submission
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, phone, housingStatus]
 *             properties:
 *               firstName: { type: string, example: "Jane" }
 *               lastName: { type: string, example: "Doe" }
 *               phone: { type: string, example: "(555) 123-4567" }
 *               housingStatus: { type: string, enum: ["Housed", "Unhoused", "Shelter", "Transitional Housing", "At Risk of Homelessness"] }
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
 *               householdSize: { type: number, example: 3 }
 *               childrenCount: { type: number, example: 1 }
 *               seniorsCount: { type: number, example: 0 }
 *               petsCount: { type: number, example: 0 }
 *               dietaryRestrictions: { type: array, items: { type: string }, example: ["Gluten-Free", "Vegetarian"] }
 *               isVeteran: { type: boolean, example: false }
 *               hasDisability: { type: boolean, example: false }
 *               monthlyIncome: { type: number, example: 1500 }
 *               citizenStatus: { type: string, enum: ["Yes", "No", "Prefer not to say"], example: "Yes" }
 *               assistancePrograms: { type: array, items: { type: string }, example: ["CalFresh", "Medi-Cal"] }
 *               consentToInformationUse: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Intake form completed successfully.
 */
router.post('/complete-intake', completeIntakeSubmission);

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
