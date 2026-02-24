const express = require('express');
const router = express.Router();
const { getStats, getHives, getOpportunities } = require('../controllers/publicController');

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
 * /api/public/hives:
 *   get:
 *     summary: Get all approved partners for public map
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of approved hives
 */
router.get('/hives', getHives);

/**
 * @swagger
 * /api/public/opportunities:
 *   get:
 *     summary: Get list of upcoming active opportunities
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of active opportunities
 */
router.get('/opportunities', getOpportunities);

module.exports = router;
