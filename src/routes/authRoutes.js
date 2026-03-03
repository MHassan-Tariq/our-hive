const express = require('express');
const router = express.Router();
const { register, login, logout, checkAvailability, forgotPassword, resetPassword, volunteerRegister, partnerRegister } = require('../controllers/authController');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Jane
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               fullName:
 *                 type: string
 *                 example: Jane Doe
 *                 description: Preferred for Mobile UI (User Name). If provided, firstName and lastName are extracted from this string.
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@ourhive.com
 *               phone:
 *                 type: string
 *                 example: "(555) 000-0000"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [visitor, participant, volunteer, donor, sponsor, partner, admin]
 *                 default: visitor
 *                 example: sponsor
 *               mailingAddress:
 *                 type: string
 *                 description: Required for In-Kind Donors (tax receipts).
 *                 example: "123 Kindness Way, City, State, ZIP"
 *     responses:
 *       201:
 *         description: User registered successfully. Returns user data and JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or email already in use.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @swagger
 * /api/auth/volunteer-register:
 *   post:
 *     summary: Consolidated Volunteer Registration with documents
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string, example: "Jane Doe" }
 *               email: { type: string, format: email, example: "jane@ourhive.com" }
 *               password: { type: string, minLength: 6, example: "password123" }
 *               phone: { type: string, example: "(555) 000-0000" }
 *               skills: { type: string, description: "JSON array or comma-separated string" }
 *               availability: { type: string, description: "JSON object string" }
 *               governmentId: { type: string, format: binary }
 *               drivingLicense: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Volunteer registered and pending approval.
 */
router.post(
  '/volunteer-register',
  require('../middleware/uploadMiddleware').fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'drivingLicense', maxCount: 1 },
  ]),
  volunteerRegister
);

/**
 * @swagger
 * /api/auth/partner-register:
 *   post:
 *     summary: Consolidated Community Partner Registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, orgName]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Smith"
 *                 description: Full name of the partner contact. If provided, firstName and lastName will be extracted from this.
 *               firstName: 
 *                 type: string
 *                 example: "John"
 *               lastName: 
 *                 type: string
 *                 example: "Smith"
 *               email: 
 *                 type: string
 *                 format: email
 *                 example: "john@springfieldfoodbank.org"
 *               password: 
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               phone: 
 *                 type: string
 *                 example: "(555) 123-4567"
 *               orgName: 
 *                 type: string
 *                 example: "Springfield Food Bank"
 *               orgType: 
 *                 type: string
 *                 example: "Non-Profit"
 *               orgAddress: 
 *                 type: string
 *                 example: "742 Evergreen Terrace"
 *               website: 
 *                 type: string
 *                 example: "https://springfieldfoodbank.org"
 *               intendedRoles: 
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Donating goods", "Hosting meal distributions"]
 *     responses:
 *       201:
 *         description: Partner registered and pending approval.
 */
router.post('/partner-register', partnerRegister);

router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@ourhive.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT token and user role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 _id: "64abc123def456"
 *                 name: "Jane Doe"
 *                 email: "jane@ourhive.com"
 *                 role: "visitor"
 *                 isApproved: false
 *       401:
 *         description: Invalid credentials.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful.
 */
router.get('/logout', logout);

/**
 * @swagger
 * /api/auth/check-availability:
 *   get:
 *     summary: Check if email or phone is already in use
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Email to check
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: Phone number to check
 *     responses:
 *       200:
 *         description: Availability status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 available: { type: boolean }
 *                 field: { type: string }
 *       400:
 *         description: Missing query parameters
 */
router.get('/check-availability', checkAvailability);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     description: Sends a password reset token to the provided email address. In development, the token is also returned in the JSON response. In production, it is only sent via email.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@ourhive.com
 *     responses:
 *       200:
 *         description: Reset link sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 resetToken: { type: string, description: "Only present in development mode" }
 *       400:
 *         description: Email is required
 *       404:
 *         description: No account found with that email
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password/{resetToken}:
 *   put:
 *     summary: Reset password using a valid reset token
 *     description: Validates the reset token (must not be expired) and sets a new password. Returns a fresh JWT on success.
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: resetToken
 *         required: true
 *         schema:
 *           type: string
 *         description: The unhashed reset token received from the forgot-password endpoint or email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: newSecurePassword123
 *     responses:
 *       200:
 *         description: Password reset successful. Returns new JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid or expired token, or password too short
 */
router.put('/reset-password/:resetToken', resetPassword);

module.exports = router;
