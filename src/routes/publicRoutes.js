const express = require('express');
const router = express.Router();
const { getStats, getHives, getOpportunities, getOpportunityDetails, getDistributionSchedule, getCampaigns, getAboutUs, getContactInfo, getUserRoles, getMissionStats, getSocialLinks } = require('../controllers/publicController');
const { optionalProtect } = require('../middleware/auth');

/**
 * @swagger
 * /api/public/stats:
 *   get:
 *     summary: Get community scale and impact statistics
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Impact stats retrieved
 */
router.get('/stats', getStats);

/**
 * @swagger
 * /api/public/about:
 *   get:
 *     summary: Get organizational About Us details
 *     description: Returns static UI text for the "About Us" screen including mission, story, and impact stats.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: About Us data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     title: { type: string, example: "Our Hive" }
 *                     subtitle: { type: string, example: "Powered By Mrs'Bs Table" }
 *                     heroImageUrl: { type: string, nullable: true, description: "Banner image for the hero section" }
 *                     logoUrl: { type: string, nullable: true, description: "Organization logo URL" }
 *                     mission: { type: string }
 *                     story: { type: string }
 *                     stats:
 *                       type: object
 *                       properties:
 *                         mealsServed: { type: string, example: "10K +" }
 *                         familiesHelped: { type: string, example: "500 +" }
 *                     ctaLabel: { type: string, example: "Join Our Table" }
 */
router.get('/about', getAboutUs);

/**
 * @swagger
 * /api/public/contact:
 *   get:
 *     summary: Get organizational Contact Us details
 *     description: Returns static UI text for the "Contact Us" screen including phone, email, address, and social links.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Contact data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     heroImageUrl: { type: string, nullable: true, description: "Hero banner image" }
 *                     heroTagline: { type: string, example: "We are here to help" }
 *                     introText: { type: string }
 *                     email: { type: string, example: "hello@nonprofit.org" }
 *                     phone: { type: string, example: "+1(555)123-4567" }
 *                     address: { type: string, example: "123 Community lan, Food Ciy, FC90210" }
 *                     socials:
 *                       type: object
 *                       properties:
 *                         linkedin: { type: string }
 *                         facebook: { type: string }
 *                         website: { type: string, description: "Globe icon links here" }
 *                         instagram: { type: string }
 *                     viewAllResourcesUrl: { type: string, nullable: true }
 *                     copyright: { type: string }
 *                     footerText: { type: string }
 */
router.get('/contact', getContactInfo);

/**
 * @swagger
 * /api/public/hives:
 *   get:
 *     summary: Get all approved partners for public map
 *     description: Returns a list of approved Partner Profiles (Food Pantries) mapping to the "Find Food" Visitor flow.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of approved hives successfully retrieved
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
 *                       _id: { type: string }
 *                       orgName: { type: string }
 *                       orgType: { type: string }
 *                       address: { type: string }
 *                       website: { type: string }
 */
router.get('/hives', getHives);

/**
 * @swagger
 * /api/public/opportunities:
 *   get:
 *     summary: Get list of upcoming active opportunities
 *     description: Returns a list of active volunteer gatherings/events mapping to the "View Calendar" Visitor flow. Supports searching by title and filtering by category.
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search active opportunities by title (case-insensitive)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter active opportunities by category (e.g. "Food Drive", "Training")
 *     responses:
 *       200:
 *         description: List of active opportunities successfully retrieved
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
 *                       _id: { type: string }
 *                       title: { type: string }
 *                       description: { type: string }
 *                       location: { type: string }
 *                       date: { type: string, format: date }
 *                       category: { type: string }
 *                       requiredVolunteers: { type: integer }
 */
router.get('/opportunities', getOpportunities);

/**
 * @swagger
 * /api/public/opportunities/{id}:
 *   get:
 *     summary: Get full details for a specific opportunity
 *     description: Returns the public, detailed view of a single community event, including the populated organizer info and the digitally calculated remainingSpots metric. Used for Screen 4 (Opportunity Details).
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The internal MongoDB ID of the Opportunity.
 *     responses:
 *       200:
 *         description: Opportunity details successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     title: { type: string }
 *                     description: { type: string }
 *                     location: { type: string }
 *                     date: { type: string, format: date }
 *                     time: { type: string }
 *                     endTime: { type: string }
 *                     category: { type: string }
 *                     requiredVolunteers: { type: integer }
 *                     remainingSpots: { type: integer, description: "Dynamically calculated spots remaining" }
 *                     partnerId: 
 *                       type: object
 *                       properties:
 *                         _id: { type: string }
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         orgName: { type: string }
 *                         profilePictureUrl: { type: string }
 *       404:
 *         description: Opportunity not found
 */
// apply optionalProtect so authenticated visitors will still have their user attached
router.get('/opportunities/:id', optionalProtect, getOpportunityDetails);

/**
 * @swagger
 * /api/public/campaigns:
 *   get:
 *     summary: Get all active community campaigns
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of campaigns retrieved.
 */
router.get('/campaigns', getCampaigns);

/**
 * @swagger
 * /api/public/schedule:
 *   get:
 *     summary: Get food distribution schedule
 *     description: Returns a date-filtered list of active food distribution slots. Supports Today, Tomorrow, and This Week filtering. Each slot includes calculated live status (isOpenNow, closesInMinutes).
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, this_week]
 *           default: today
 *         description: Date range filter for the schedule
 *     responses:
 *       200:
 *         description: Distribution schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 filter: { type: string }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       title: { type: string }
 *                       location: { type: string }
 *                       specificLocation: { type: string }
 *                       date: { type: string, format: date }
 *                       time: { type: string, example: "9:00 AM" }
 *                       endTime: { type: string, example: "12:00 PM" }
 *                       imageurl: { type: string }
 *                       category: { type: string }
 *                       isOpenNow: { type: boolean, description: "Whether this slot is currently open" }
 *                       closesInMinutes: { type: integer, description: "Minutes until closing (null if not open)" }
 *                       coordinates:
 *                         type: object
 *                         properties:
 *                           lat: { type: number, example: 39.7817 }
 *                           lng: { type: number, example: -89.6501 }
 *                       partnerId:
 *                         type: object
 *                         properties:
 *                           orgName: { type: string }
 *                           organizationLogoUrl: { type: string }
 */
router.get('/schedule', getDistributionSchedule);

/**
 * @swagger
 * /api/public/user-roles:
 *   get:
 *     summary: Get available user roles for registration
 *     description: Returns the list of selectable roles shown on the "Let's Get Started" registration role selection screen. The selected role's `key` must be passed as the `role` field in POST /api/auth/register.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                         enum: [participant, volunteer, donor, sponsor, partner]
 *                         description: The role identifier to pass to POST /api/auth/register
 *                       label: { type: string, example: "Participant" }
 *                       description: { type: string, example: "I need assistance and resources" }
 *                       icon: { type: string, description: "Icon key for the mobile UI to resolve" }
 */
router.get('/user-roles', getUserRoles);

/**
 * @swagger
 * /api/public/mission-stats:
 *   get:
 *     summary: Get aggregate mission impact stats
 *     description: Returns data for the "Support Our Mission" screen.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Mission stats retrieved.
 */
router.get('/mission-stats', getMissionStats);

/**
 * @swagger
 * /api/public/social-links:
 *   get:
 *     summary: Get social media links
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Social links retrieved
 */
router.get('/social-links', getSocialLinks);

module.exports = router;
