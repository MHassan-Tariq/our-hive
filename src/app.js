const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const sponsorRoutes = require('./routes/sponsorRoutes');
const donationRoutes = require('./routes/donationRoutes');
const participantRoutes = require('./routes/participantRoutes');
const hiveRoutes = require('./routes/hiveRoutes');
const publicRoutes = require('./routes/publicRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Our Hive API Docs',
    swaggerOptions: {
      persistAuthorization: true, // Keeps Bearer token after page refresh
      docExpansion: 'list',       // Start with endpoints collapsed for readability
      filter: true,               // Enable search filter bar
      tryItOutEnabled: true,      // Enable "Try it out" by default
    },
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .topbar-wrapper .link { display: none; }
      .swagger-ui .info .title { color: #e94560; }
    `,
  })
);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/participant', participantRoutes);
app.use('/api/hives', hiveRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/user', userRoutes);

// ─── Root Health Check ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const fullUrl = `${protocol}://${host}`;
  
  res.json({
    message: '🐝 Our Hive API is running',
    docs: `${fullUrl}/api-docs`,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
