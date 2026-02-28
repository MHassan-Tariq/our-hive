Below is the complete Swagger API documentation for the entire "Our Hive" application backend.

> [!NOTE]
> All file uploads (Profile Pictures, Logos, Flyers) are processed via Cloudinary. Response URLs provided by the API are direct cloud storage links.

---

## **1. Authentication (Auth)**

```yaml
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
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string, example: Jane }
 *               lastName: { type: string, example: Doe }
 *               fullName: { type: string, example: Jane Doe }
 *               email: { type: string, format: email, example: jane@ourhive.com }
 *               phone: { type: string, example: "(555) 000-0000" }
 *               password: { type: string, minLength: 6, example: password123 }
 *               role: { type: string, enum: [visitor, participant, volunteer, donor, sponsor, partner, admin], default: visitor }
 *               mailingAddress: { type: string, description: Required for In-Kind Donors }
 *     responses:
 *       201:
 *         description: User registered successfully. Returns user data and JWT token.
 */

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
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: jane@ourhive.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT token and user role.
 */

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

/**
 * @swagger
 * /api/auth/check-availability:
 *   get:
 *     summary: Check if email or phone is already in use
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: phone
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Availability status returned
 */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Email sent successfully. Returns status and confirmation message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: string, example: "Email sent" }
 */

/**
 * @swagger
 * /api/auth/reset-password/{resetToken}:
 *   put:
 *     summary: Reset password using a valid reset token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: resetToken
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Password reset successful. Returns new JWT token.
 */
/**
 * @swagger
 * /api/admin/events:
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
```

---

## **2. Public Endpoints**

```yaml
/**
 * @swagger
 * /api/public/stats:
 *   get:
 *     summary: Get community scale and impact statistics
 *     tags: [Public]
 *     responses:
 *       200: { description: Impact stats retrieved }
 */

/**
 * @swagger
 * /api/public/about:
 *   get:
 *     summary: Get organizational About Us details
 *     tags: [Public]
 *     responses:
 *       200: { description: About Us data retrieved }
 */

/**
 * @swagger
 * /api/public/contact:
 *   get:
 *     summary: Get organizational Contact Us details
 *     tags: [Public]
 *     responses:
 *       200: { description: Contact data retrieved }
 */

/**
 * @swagger
 * /api/public/hives:
 *   get:
 *     summary: Get all approved partners for public map
 *     tags: [Public]
 *     responses:
 *       200: { description: List of approved hives successfully retrieved }
 */

/**
 * @swagger
 * /api/public/opportunities:
 *   get:
 *     summary: Get list of upcoming active opportunities
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of active opportunities successfully retrieved }
 */

/**
 * @swagger
 * /api/public/opportunities/{id}:
 *   get:
 *     summary: Get specific event details
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Event details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     time: { type: string }
 *                     endTime: { type: string }
 */

/**
 * @swagger
 * /api/public/opportunities/{id}:
 *   get:
 *     summary: Get full details for a specific opportunity
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Opportunity details successfully retrieved }
 */

/**
 * @swagger
 * /api/public/campaigns:
 *   get:
 *     summary: Get all active community campaigns
 *     tags: [Public]
 *     responses:
 *       200: { description: List of campaigns retrieved. }
 */

/**
 * @swagger
 * /api/public/schedule:
 *   get:
 *     summary: Get food distribution schedule
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, tomorrow, this_week], default: today }
 *     responses:
 *       200: { description: Distribution schedule retrieved successfully }
 */

/**
 * @swagger
 * /api/public/user-roles:
 *   get:
 *     summary: Get available user roles for registration
 *     tags: [Public]
 *     responses:
 *       200: { description: Roles retrieved successfully }
 */
```

---

## **3. Participant Portal**

_Requires `Bearer <token>` and `participant` role._

```yaml
/**
 * @swagger
 * /api/participant/profile:
 *   post:
 *     summary: Save or update participant profile
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *   get:
 *     summary: Get full participant profile
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/my-feed:
 *   get:
 *     summary: Get personalized feed of opportunities and donations
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/request-service/{id}:
 *   post:
 *     summary: Request a service/item and generate a digital voucher
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/participant/dashboard:
 *   get:
 *     summary: Get Participant Dashboard Overview
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/intake-step:
 *   patch:
 *     summary: Update intake progress step
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/upload-document:
 *   post:
 *     summary: Upload compliance document (ID/Proof)
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/send-verification-code:
 *   post:
 *     summary: Request email verification code (OTP)
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/verify-code:
 *   post:
 *     summary: Verify email OTP code
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/participant/pantries:
 *   get:
 *     summary: Get a searchable list of active pantries/opportunities
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 */
```

---

## **4. Volunteer Portal**

_Requires `Bearer <token>` and `volunteer` role._

```yaml
/**
 * @swagger
 * /api/volunteer/profile:
 *   get:
 *     summary: Get volunteer profile
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Save or update volunteer profile
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/volunteer/dashboard:
 *   get:
 *     summary: Get volunteer dashboard statistics
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/volunteer/log-hours:
 *   post:
 *     summary: Log volunteer hours
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/volunteer/logs:
 *   get:
 *     summary: Get log history
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/volunteer/badges/{id}:
 *   get:
 *     summary: Get details for a specific badge
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/volunteer/my-tasks:
 *   get:
 *     summary: Get all opportunities the volunteer has joined
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 */
```

---

## **5. Admin Portal**

_Requires `Bearer <token>` and `admin` role._

```yaml
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get Admin Dashboard Overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all system users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/partners/{id}/status:
 *   patch:
 *     summary: Approve or reject a partner organization
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/opportunities/{id}/status:
 *   patch:
 *     summary: Approve or reject a volunteer opportunity/event
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/volunteer/add-hours/{id}:
 *   patch:
 *     summary: Manually add hours to a volunteer profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/finances:
 *   get:
 *     summary: Get financial overview & top sponsors
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/participants/summary:
 *   get:
 *     summary: Get participant summary (privacy-masked names)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/participants:
 *   get:
 *     summary: List participants with pagination, search, and filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/participants/export:
 *   get:
 *     summary: Export all participants as CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/participants/{id}:
 *   get:
 *     summary: Get full participant detail (Admin view)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     summary: Edit participant profile fields (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/participants/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a participant account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/in-kind-donations:
 *   get:
 *     summary: List all in-kind donations with stats and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/in-kind-donations/export:
 *   get:
 *     summary: Export in-kind donations as CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/in-kind-donations/{id}:
 *   get:
 *     summary: Get full In-Kind Donation detail (Admin view)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/in-kind-donations/{id}/status:
 *   patch:
 *     summary: Update an In-Kind Donation status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/admin/volunteers/{id}:
 *   patch:
 *     summary: Update volunteer profile (Admin)
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
 *               fullName: { type: string }
 *               phone: { type: string }
 *               backgroundCheckStatus: { type: string, enum: [Not Started, Pending, Verified, Action Required] }
 *     responses:
 *       200:
 *         description: Profile updated.
 *       404:
 *         description: Profile not found.
 */
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
```

---

## **6. Donor Portal (In-Kind)**

_Requires `Bearer <token>` and `donor` role._

```yaml
/**
 * @swagger
 * /api/donations/dashboard:
 *   get:
 *     summary: Get donor dashboard overview (hybrid impact)
 *     tags: [Donations]
 */

/**
 * @swagger
 * /api/donations:
 *   post:
 *     summary: Offer a new in-kind donation (Donor only)
 *     tags: [Donations]
 */

/**
 * @swagger
 * /api/donations/my:
 *   get:
 *     summary: Get items I have offered
 *     tags: [Donations]
 */**
/**
 * @swagger
 * /api/donations/profile:
 *   patch:
 *     summary: Update donor profile settings (e.g. monthly goal)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monthlyGoal: { type: number, example: 85 }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
/**
 * @swagger
 * /api/donations/{id}:
 *   patch:
 *     summary: Update a pending in-kind donation offering (Donor only)
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               itemName: { type: string }
 *               itemCategory: { type: string }
 *               description: { type: string }
 *               quantity: { type: string }
 *               itemPhoto: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Donation updated.
 */
```

---

## **7. Sponsor Portal (Monetary)**

_Requires `Bearer <token>` and `sponsor` role._

```yaml
/**
 * @swagger
 * /api/sponsor/dashboard:
 *   get:
 *     summary: Get sponsor dashboard data
 *     tags: [Sponsors]
 */

/**
 * @swagger
 * /api/sponsor/donate:
 *   post:
 *     summary: Record a monetary donation
 *     description: Simulation: $2.50 = 1 meal. Tier upgrades: Supporter -> Bronze -> Silver -> Gold.
 *     tags: [Sponsors]
 */

/**
 * @swagger
 * /api/sponsor/impact:
 *   get:
 *     summary: Get sponsor impact summary
 *     tags: [Sponsors]
 */

/**
 * @swagger
 * /api/sponsor/campaigns:
 *   get:
 *     summary: Get all fundraising campaigns
 *     tags: [Sponsors]
 */
/**
 * @swagger
 * /api/sponsor/profile:
 *   patch:
 *     summary: Update sponsor organization profile
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName: { type: string }
 *               isAnonymous: { type: boolean }
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
```

---

## **8. Partner Portal**

_Requires `Bearer <token>` and `partner` role._

```yaml
/**
 * @swagger
 * /api/partners/profile:
 *   post:
 *     summary: Submit organization profile
 *     tags: [Partners]
 */

/**
 * @swagger
 * /api/partners/dashboard:
 *   get:
 *     summary: Get partner dashboard overview
 *     tags: [Partners]
 */

/**
 * @swagger
 * /api/opportunities:
 *   post:
 *     summary: Create a new volunteer opportunity/event
 *     tags: [Opportunities]
 */

/**
 * @swagger
 * /api/opportunities/partner:
 *   get:
 *     summary: Get opportunities created by the partner
 *     tags: [Opportunities]
 */

/**
 * @swagger
 * /api/donations/assigned:
 *   get:
 *     summary: Get in-kind donations assigned to this partner
 *     tags: [Partners]
 */
```

---

## **9. User Account & Settings**

_Requires `Bearer <token>`._

```yaml
/**
 * @swagger
 * /api/user/settings:
 *   get:
 *     summary: Get user settings and preferences
 *     tags: [Users]
 *   patch:
 *     summary: Update user preferences
 *     tags: [Users]
 */

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     summary: Get segmented notifications (New vs. Earlier)
 *     tags: [Users]
 */

/**
 * @swagger
 * /api/user/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Users]
 */

/**
 * @swagger
 * /api/user/select-role:
 *   patch:
 *     summary: Upgrade visitor account to a specific role
 *     tags: [Users]
 */
/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     summary: Update core user profile fields
 *     description: Update firstName, lastName, phone, and mailingAddress.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               mailingAddress: { type: string }
 *               profilePicture: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
```

---

## **10. Hive Scanner (Voucher Redemption)**

_Requires `partner` or `admin` role._

```yaml
/**
 * @swagger
 * /api/hives/redeem-voucher:
 *   post:
 *     summary: Redeem a participant's digital voucher
 *     tags: [Hives]
 */
```

---

## **11. Application Flows**

### **The Visitor Journey**

1. **Discovery**: Visitor explores public stats, hives map, and opportunities without logging in.
2. **Registration**: Visitor registers with basic info. They can browse but have limited portal access.
3. **Role Selection**: Visitor chooses a role (Volunteer, Donor, Sponsor, Participant).
4. **Onboarding**: Depending on the role, they complete their profile (e.g., identity verification for Volunteers, household details for Participants).

### **The Impact Cycle**

1. **Resource Generation**: Sponsors donate money; Donors offer in-kind items.
2. **Logistics**: Volunteers claim in-kind items for pickup/delivery to Partners (Hives).
3. **Distribution**: Partners create opportunities/events. Participants request services and receive digital vouchers.
4. **Redemption**: Partners use the scanner to verify and redeem participant vouchers.
