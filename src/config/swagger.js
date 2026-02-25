const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Our Hive API',
      version: '1.0.0',
      description: 'API for coordinating in-kind donations and volunteer opportunities.',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
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
              enum: ['visitor', 'participant', 'volunteer', 'partner', 'donor', 'sponsor', 'admin'],
              example: 'volunteer',
            },
            isApproved: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PartnerProfile: {
          type: 'object',
          properties: {
            orgName: { type: 'string', example: 'Acme Charity' },
            orgType: { type: 'string', example: 'NGO' },
            address: { type: 'string', example: '123 Charity Lane' },
            website: { type: 'string', example: 'https://charity.org' },
            intendedRoles: {
              type: 'array',
              items: { type: 'string' },
              example: ['Food Distribution'],
            },
            agreements: {
              type: 'object',
              properties: {
                isAuthorized: { type: 'boolean', example: true },
                agreedToTerms: { type: 'boolean', example: true },
                understandOperationalControl: { type: 'boolean', example: true },
              },
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              example: 'pending',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        VolunteerProfile: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: '64abc123def456' },
            fullName: { type: 'string', example: 'Jane Smith' },
            phone: { type: 'string', example: '+92 300 1234567' },
            skills: {
              type: 'array',
              items: { type: 'string' },
              example: ['First Aid', 'Teaching'],
            },
            availability: {
              type: 'object',
              properties: {
                morning: { type: 'boolean' },
                afternoon: { type: 'boolean' },
                evenings: { type: 'boolean' },
                weekend: { type: 'boolean' },
              },
            },
            governmentIdUrl: { type: 'string', example: 'https://cdn.ourhive.com/docs/id.jpg' },
            drivingLicenseUrl: { type: 'string', example: 'https://cdn.ourhive.com/docs/license.jpg' },
            agreedToHandbook: { type: 'boolean', example: true },
            profilePictureUrl: { type: 'string', example: 'https://cdn.ourhive.com/avatars/jane.jpg' },
            location: { type: 'string', example: 'New York, NY' },
            totalDeliveries: { type: 'number', example: 5 },
            totalImpact: { type: 'string', example: '1.2k lbs' },
            backgroundCheckStatus: { type: 'string', enum: ['Not Started', 'Pending', 'Verified', 'Action Required'], example: 'Verified' },
            hoursThisYear: { type: 'number', example: 124 },
            nextBadgeGoal: { type: 'number', example: 10 },
            totalHours: { type: 'integer', example: 130 },
            badges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Master of Design' },
                  level: { type: 'string', example: 'Expert Level' },
                  badgeId: { type: 'string', example: '#BDG-7729' },
                  earnedAt: { type: 'string', format: 'date' },
                  hoursRequired: { type: 'number', example: 15 },
                },
              },
            },
            joinedOpportunities: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        Sponsor: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: '64abc123def456' },
            organizationName: { type: 'string', example: 'Acme Corp' },
            totalContributed: { type: 'number', example: 1500 },
            tier: {
              type: 'string',
              enum: ['Supporter', 'Bronze', 'Silver', 'Gold'],
              example: 'Silver',
            },
            isAnonymous: { type: 'boolean', example: false },
          },
        },
        InKindDonation: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64don789abc123' },
            donorId: { type: 'string', example: '64abc123def456' },
            refId: { type: 'string', example: 'OH-8821' },
            itemName: { type: 'string', example: '10 Cases of Water' },
            itemCategory: {
              type: 'string',
              enum: ['Food', 'Clothing', 'Furniture', 'Electronics', 'Other'],
              example: 'Clothing',
            },
            description: { type: 'string', example: '10 boxes of winter jackets' },
            quantity: { type: 'string', example: '10 Boxes' },
            itemPhotoUrl: { type: 'string', example: 'https://cdn.ourhive.com/items/jackets.jpg' },
            estimatedValue: { type: 'string', example: '$50' },
            deliveryMethod: { type: 'string', enum: ['pickup', 'drop-off'], example: 'pickup' },
            additionalNotes: { type: 'string', example: 'Gate code 1234' },
            petInfo: {
              type: 'object',
              properties: {
                hasCat: { type: 'boolean', example: false },
                hasDog: { type: 'boolean', example: true }
              }
            },
            locationName: { type: 'string', example: 'Main Warehouse' },
            storageDetails: {
              type: 'object',
              properties: {
                room: { type: 'string', example: 'Room A' },
                rack: { type: 'string', example: 'Rack 2' },
                shelf: { type: 'string', example: 'Shelf 1' }
              }
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'scheduled', 'completed', 'rejected'],
              example: 'pending',
            },
            rejectionReason: { type: 'string', example: 'Storage requirements not met.' },
            assignedVolunteerId: { type: 'string', nullable: true },
            recipientId: { type: 'string', nullable: true },
            pickupDate: { type: 'string', format: 'date-time' },
            deliveredDate: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Opportunity: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64abc123def456' },
            partnerId: { type: 'string', example: '64xyz987uvw654' },
            title: { type: 'string', example: 'Food Drive' },
            description: { 
              type: 'string', 
              maxLength: 500, 
              example: 'Help distribute food to those in need.' 
            },
            location: { type: 'string', example: 'Community Center' },
            specificLocation: { type: 'string', example: 'Main Entrance, 100 Civic Way' },
            coordinates: {
              type: 'object',
              properties: {
                lat: { type: 'number', example: 39.7817 },
                lng: { type: 'number', example: -89.6501 }
              }
            },
            whatToBring: {
              type: 'array',
              items: { type: 'string' },
              example: ['Heavy-duty work gloves', 'Comfortable walking shoes', 'Refillable water bottle']
            },
            spotsLeft: { type: 'integer', example: 5 },
            statusBadge: { type: 'string', example: 'Filling Fast', nullable: true },
            durationString: { type: 'string', example: ' (3 hours)' },
            date: { type: 'string', format: 'date' },
            time: { type: 'string', example: '10:00 AM' },
            endTime: { type: 'string', example: '1:00 PM' },
            type: { type: 'string', enum: ['event', 'opportunity'], example: 'opportunity' },
            flyerUrl: { type: 'string', example: 'https://example.com/flyer.jpg', nullable: true },
            status: {
              type: 'string',
              enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'],
              example: 'pending'
            },
            requiredVolunteers: { type: 'integer', example: 10 },
            impactStatement: { type: 'string', example: 'Your help today provide 50 meal for local families in need.' },
            physicalRequirements: { type: 'string', example: 'Must be able to lift 20 lbs and stand for 3 hours.' },
            dressCode: { type: 'string', example: 'Closed-toe shoes and comfortable clothing required.' },
            orientation: { type: 'string', example: 'Brief 10- minute training provided ar the start shift' },
            attendees: { type: 'array', items: { type: 'string' } },
          },
        },
        ActivityLog: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64act123def456' },
            userId: { type: 'string', example: '64xyz987uvw654' },
            type: {
              type: 'string',
              example: 'Submission Approved'
            },
            content: {
              type: 'string',
              example: 'Your organization has been approved.'
            },
            relatedId: { type: 'string', example: '64abc123def456', nullable: true },
            relatedModel: {
              type: 'string',
              enum: ['Opportunity', 'InKindDonation', 'PartnerProfile'],
              nullable: true
            },
            createdAt: { type: 'string', format: 'date-time' },
          }
        },
        NotificationResponse: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6fbf8c123def456' },
            userId: { type: 'string', example: '64xyz987uvw654' },
            title: { type: 'string', example: 'Intake Approved' },
            message: { type: 'string', example: 'Your Community intake form has been approved. Welcome to the hive!' },
            type: { type: 'string', enum: ['approval', 'reminder', 'update', 'system'], example: 'approval' },
            iconType: { type: 'string', enum: ['checkmark', 'info'], example: 'checkmark' },
            isRead: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        AuthResponse: {
          type: 'object',

          properties: {
            success: { type: 'boolean', example: true },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1...' },
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
        PartnerProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { $ref: '#/components/schemas/PartnerProfile' },
          }
        },
        VolunteerProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { $ref: '#/components/schemas/VolunteerProfile' },
          }
        },
        InKindDonationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { $ref: '#/components/schemas/InKindDonation' },
          }
        },
        OpportunityResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { $ref: '#/components/schemas/Opportunity' },
          }
        },
        SponsorImpactResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                totalContributed: { type: 'number', example: 750 },
                tier: { type: 'string', example: 'Bronze' },
                organizationName: { type: 'string', example: 'Acme Corp' },
                isAnonymous: { type: 'boolean', example: false },
                nextTier: { type: 'string', example: 'Silver' },
                nextTierThreshold: { type: 'number', example: 1000 },
                amountToNextTier: { type: 'number', example: 250 },
              },
            },
          }
        }
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
