const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Our Hive API',
      version: '1.0.0',
      description:
        'REST API for Our Hive platform — manage users, roles, and community members.',
      contact: {
        name: 'Our Hive Team',
      },
    },
    servers: [
      {
        url: 'https://our-hive.vercel.app',
        description: 'Production Server (Vercel)',
      },
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter your JWT token here. Example: **eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...**',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64abc123def456' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' },
            role: {
              type: 'string',
              enum: [
                'visitor',
                'participant',
                'volunteer',
                'donor',
                'sponsor',
                'partner',
                'admin',
              ],
              example: 'visitor',
            },
            isApproved: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message here' },
          },
        },
        DashboardResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                roleCounts: {
                  type: 'object',
                  example: {
                    visitor: 10,
                    participant: 5,
                    volunteer: 3,
                    donor: 2,
                    sponsor: 1,
                    partner: 4,
                    admin: 1,
                  },
                },
                pendingPartners: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
                totalUsers: { type: 'integer', example: 26 },
              },
            },
          },
        },
        // ── Partner Schemas ───────────────────────────────────────────────
        PartnerProfile: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64abc123def456' },
            userId: { type: 'string', example: '64xyz987uvw654' },
            orgName: { type: 'string', example: 'Acme Community Foundation' },
            orgType: { type: 'string', example: 'Non-Profit Organization' },
            address: { type: 'string', example: '123 Main St, Karachi, Pakistan' },
            website: { type: 'string', example: 'https://acme.org' },
            intendedRoles: {
              type: 'array',
              items: { type: 'string' },
              example: ['Donating food', 'Hosting events'],
            },
            agreements: {
              type: 'object',
              properties: {
                isAuthorized: { type: 'boolean', example: true },
                agreedToTerms: { type: 'boolean', example: true },
              },
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              example: 'pending',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PartnerProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Partner profile submitted successfully.' },
            data: { $ref: '#/components/schemas/PartnerProfile' },
          },
        },
        // ── Opportunity Schemas ───────────────────────────────────────────
        Opportunity: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64opp123abc789' },
            partnerId: { type: 'string', example: '64xyz987uvw654' },
            title: { type: 'string', example: 'Weekend Food Drive' },
            description: { type: 'string', example: 'Help sort and distribute donated food.' },
            location: { type: 'string', example: 'Clifton Community Center, Karachi' },
            date: { type: 'string', format: 'date-time', example: '2026-03-15T09:00:00.000Z' },
            category: { type: 'string', example: 'Food Security' },
            requiredVolunteers: { type: 'integer', example: 15 },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'cancelled'],
              example: 'active',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        OpportunityResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Opportunity created successfully.' },
            data: { $ref: '#/components/schemas/Opportunity' },
          },
        },
        // ── Volunteer Schemas ───────────────────────────────────────────
        VolunteerProfile: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64vol789xyz321' },
            userId: { type: 'string', example: '64abc123def456' },
            fullName: { type: 'string', example: 'Ahmed Khan' },
            phone: { type: 'string', example: '+92-300-1234567' },
            skills: {
              type: 'array',
              items: { type: 'string' },
              example: ['Driving', 'First Aid', 'Cooking'],
            },
            availability: {
              type: 'object',
              properties: {
                weekdays: { type: 'boolean', example: true },
                weekends: { type: 'boolean', example: false },
              },
            },
            totalHours: { type: 'number', example: 12 },
            joinedOpportunities: {
              type: 'array',
              items: { type: 'string' },
              example: ['64opp123abc789', '64opp456def012'],
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        VolunteerProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Volunteer profile saved successfully.' },
            data: { $ref: '#/components/schemas/VolunteerProfile' },
          },
        },
        // ── Sponsor Schemas ──────────────────────────────────────────────
        Sponsor: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64spo789abc321' },
            userId: { type: 'string', example: '64abc123def456' },
            organizationName: { type: 'string', example: 'Acme Corp' },
            totalContributed: { type: 'number', example: 1500 },
            tier: {
              type: 'string',
              enum: ['Supporter', 'Bronze', 'Silver', 'Gold'],
              example: 'Silver',
            },
            isAnonymous: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SponsorImpactResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                totalContributed: { type: 'number', example: 750 },
                tier: { type: 'string', enum: ['Supporter', 'Bronze', 'Silver', 'Gold'], example: 'Bronze' },
                organizationName: { type: 'string', example: 'Acme Corp' },
                isAnonymous: { type: 'boolean', example: false },
                nextTier: { type: 'string', example: 'Silver', nullable: true },
                nextTierThreshold: { type: 'number', example: 1000, nullable: true },
                amountToNextTier: { type: 'number', example: 250 },
              },
            },
          },
        },
        // ── InKind Donation Schemas ───────────────────────────────────────
        InKindDonation: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64don789abc123' },
            donorId: { type: 'string', example: '64abc123def456' },
            itemCategory: {
              type: 'string',
              enum: ['Food', 'Clothing', 'Furniture', 'Electronics', 'Other'],
              example: 'Clothing',
            },
            description: { type: 'string', example: '10 boxes of winter jackets' },
            itemPhotoUrl: { type: 'string', example: 'https://cdn.ourhive.com/items/jackets.jpg' },
            pickupAddress: {
              type: 'object',
              description: 'Only returned after a volunteer has claimed this item',
              properties: {
                street: { type: 'string', example: '42 Defence Road' },
                city: { type: 'string', example: 'Karachi' },
                zip: { type: 'string', example: '75500' },
              },
            },
            status: {
              type: 'string',
              enum: ['offered', 'claimed', 'picked-up', 'delivered'],
              example: 'offered',
            },
            assignedVolunteerId: {
              type: 'string',
              nullable: true,
              example: null,
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InKindDonationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Item posted successfully.' },
            data: { $ref: '#/components/schemas/InKindDonation' },
          },
        },
        ParticipantProfile: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            interests: { type: 'array', items: { type: 'string' } },
            residenceArea: { type: 'string' },
            vouchers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  serviceId: { type: 'string' },
                  serviceType: { type: 'string', enum: ['Opportunity', 'InKindDonation'] },
                  status: { type: 'string', enum: ['active', 'redeemed', 'expired'] },
                  qrCodeData: { type: 'string' }
                }
              }
            }
          }
        },
        PublicStats: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                totalBees: { type: 'integer', example: 150 },
                activeHives: { type: 'integer', example: 12 },
                volunteerImpact: { type: 'number', example: 450 },
                financialSupport: { type: 'number', example: 12500 }
              }
            }
          }
        }
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      {
        name: 'Admin',
        description: 'Admin-only endpoints (requires Bearer Token)',
      },
      {
        name: 'Partners',
        description: 'Partner onboarding & profile management (requires partner role)',
      },
      {
        name: 'Opportunities',
        description: 'Volunteer opportunity management (create & browse)',
      },
      {
        name: 'Volunteers',
        description: 'Volunteer profile & task tracking (requires volunteer role)',
      },
      {
        name: 'Sponsors',
        description: 'Sponsor donation recording & tier impact dashboard (requires sponsor role)',
      },
      {
        name: 'Donations',
        description: 'In-kind donation logistics — offer items, claim pickups (donor & volunteer roles)',
      },
      {
        name: 'Participants',
        description: 'Participant matching & voucher system',
      },
      {
        name: 'Hives',
        description: 'Handshake redemption for services & items',
      },
      {
        name: 'Public',
        description: 'Auth-free endpoints for guest mode',
      },
      {
        name: 'Users',
        description: 'User-specific actions (e.g., role selection)',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
