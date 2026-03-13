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
  completeIntakeSubmission,
  updatePersonalInfo,
  uploadDocuments,
  updateLivingInfo

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
 *               annualIncome: { type: string, example: "50000" }
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
 *     description: Returns comprehensive participant profile data including personal info, address, household, housing, income, documents with URLs, assistance programs, and intake status.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     name: { type: string, example: "John Doe" }
 *                     participantId: { type: string, example: "#4265568" }
 *                     profileImage: { type: string, example: "https://cloudinary.com/..." }
 *                     personalInfo:
 *                       type: object
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                         phone: { type: string }
 *                         gender: { type: string, enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say'] }
 *                         dateOfBirth: { type: string, format: date }
 *                         race: { type: string }
 *                         ethnicity: { type: string }
 *                     address:
 *                       type: object
 *                       properties:
 *                         fullAddress: { type: string, example: "123 Main St, Apt 4B, Los Angeles, CA, 90001" }
 *                         street: { type: string }
 *                         unit: { type: string }
 *                         city: { type: string }
 *                         state: { type: string }
 *                         zipCode: { type: string }
 *                     householdDetails:
 *                       type: object
 *                       properties:
 *                         familySize: { type: integer }
 *                         childrenCount: { type: integer }
 *                         seniorsCount: { type: integer }
 *                         petsCount: { type: integer }
 *                         isVeteran: { type: boolean }
 *                         hasDisability: { type: boolean }
 *                     housing:
 *                       type: object
 *                       properties:
 *                         housingStatus: { type: string, enum: ['Housed', 'Unhoused', 'At Risk'] }
 *                         annualIncome: { type: string, example: "$25,000 - $50,000" }
 *                     documents:
 *                       type: object
 *                       properties:
 *                         count: { type: integer }
 *                         list:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               documentType: { type: string, example: "ID" }
 *                               fileUrl: { type: string, example: "https://cloudinary.com/..." }
 *                               status: { type: string, enum: ['pending', 'approved', 'rejected'] }
 *                               uploadedAt: { type: string, format: date-time }
 *                         status: { type: string }
 *                     assistance:
 *                       type: object
 *                       properties:
 *                         assistancePrograms: { type: array, items: { type: string }, example: ["SNAP", "Medicaid"] }
 *                         dietaryRestrictions: { type: array, items: { type: string }, example: ["Vegetarian", "Gluten-Free"] }
 *                         citizenStatus: { type: string }
 *                     intake:
 *                       type: object
 *                       properties:
 *                         status: { type: string, enum: ['Action Required', 'Pending Review', 'Approved', 'Rejected'] }
 *                         currentStep: { type: integer }
 *                         totalSteps: { type: integer }
 *                         percentage: { type: number }
 *                     isIntakeApproved: { type: boolean }
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
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
 *                   annualIncome: { type: string }
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
 *               annualIncome: { type: string, example: "45000" }
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

/**
 * @swagger
 * /api/participant/personal-info:
 *   patch:
 *     summary: Update participant personal information
 *     description: Update personal details including name, contact info, date of birth, race, ethnicity, and address. Profile ID is extracted from JWT token.
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
 *               fullName: { type: string, example: "Jane Doe", description: "Full name (auto-splits into firstName and lastName if provided)" }
 *               firstName: { type: string, example: "Jane", description: "First name (used if fullName not provided)" }
 *               lastName: { type: string, example: "Doe", description: "Last name (used if fullName not provided)" }
 *               phone: { type: string, example: "(555) 123-4567" }
 *               email: { type: string, example: "jane@example.com" }
 *               dateOfBirth: { type: string, format: date, example: "1990-05-15" }
 *               gender: { type: string, enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say'] }
 *               race: { type: string, example: "African American" }
 *               ethnicity: { type: string, example: "Hispanic" }
 *               street: { type: string, example: "123 Main St" }
 *               unit: { type: string, example: "Apt 4B" }
 *               city: { type: string, example: "Los Angeles" }
 *               state: { type: string, example: "CA" }
 *               zipCode: { type: string, example: "90001" }
 *               profileImage: { type: string, format: binary, description: "Profile picture file (JPG, PNG, GIF - max 5MB)" }
 *     responses:
 *       '200':
 *         description: Personal information updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     personalInfo:
 *                       type: object
 *                       properties:
 *                         fullName: { type: string }
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string }
 *                         phone: { type: string }
 *                         gender: { type: string }
 *                         profileImage: { type: string }
 *                         dateOfBirth: { type: string }
 *                         race: { type: string }
 *                         ethnicity: { type: string }
 *                     address: { type: object }
 *       '404':
 *         description: Participant profile not found
 *       '500':
 *         description: Server error
 */
router.patch('/personal-info', upload.single('profilePictureUrl'), updatePersonalInfo);

/**
 * @swagger
 * /api/participant/documents:
 *   patch:
 *     summary: Upload or update participant documents
 *     description: Upload up to 2 documents for participant profile with document types. Profile ID is extracted from JWT token.
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
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 maxItems: 2
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Document files (PDF, JPG, PNG - max 2 files, 5MB each)
 *               documentType_0: { type: string, example: "ID", description: "Type of first document (ID, Proof of Address, etc.)" }
 *               documentType_1: { type: string, example: "Proof of Address", description: "Type of second document" }
 *     responses:
 *       '200':
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     documents: { type: array }
 *                     intakeStatus: { type: object }
 *       '400':
 *         description: No files provided
 *       '404':
 *         description: Participant profile not found
 *       '500':
 *         description: Server error
 */
router.patch('/documents', upload.array('documents', 2), uploadDocuments);

/**
 * @swagger
 * /api/participant/living-info:
 *   patch:
 *     summary: Update participant living and property information
 *     description: Update housing status, household details, income, and assistance needs. Profile ID is extracted from JWT token.
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
 *               housingStatus: { type: string, enum: ['Housed', 'Unhoused', 'At Risk'], example: "Housed" }
 *               householdSize: { type: integer, example: 3 }
 *               childrenCount: { type: integer, example: 2 }
 *               seniorsCount: { type: integer, example: 0 }
 *               petsCount: { type: integer, example: 1 }
 *               isVeteran: { type: boolean, example: false }
 *               hasDisability: { type: boolean, example: false }
 *               annualIncome: { type: string, example: "$25,000 - $50,000" }
 *               citizenStatus: { type: string, example: "US Citizen" }
 *               dietaryRestrictions: 
 *                 oneOf:
 *                   - type: string
 *                     example: "Vegetarian,Gluten-Free"
 *                   - type: array
 *                     items: { type: string }
 *               assistancePrograms:
 *                 oneOf:
 *                   - type: string
 *                     example: "SNAP,Medicaid"
 *                   - type: array
 *                     items: { type: string }
 *     responses:
 *       '200':
 *         description: Living information updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     housingStatus: { type: string }
 *                     household: { type: object }
 *                     personalStatus: { type: object }
 *                     income: { type: object }
 *                     assistance: { type: object }
 *                     intakeStatus: { type: object }
 *       '404':
 *         description: Participant profile not found
 *       '500':
 *         description: Server error
 */
router.patch('/living-info', updateLivingInfo);

module.exports = router;
