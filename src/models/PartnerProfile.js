const mongoose = require('mongoose');

const PartnerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    partnerId: {
      type: String,
      unique: true,
      sparse: true,
    },
    orgName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [100, 'Organization name cannot be more than 100 characters'],
    },
    orgType: {
      type: String,
      trim: true,
      maxlength: [50, 'Organization type cannot be more than 50 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    legalEntityName: {
      type: String,
      trim: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    headquarters: {
      type: String,
      trim: true,
    },
    taxStatus: {
      type: String,
      trim: true,
    },
    companyOverview: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot be more than 200 characters'],
    },
    website: {
      type: String,
      trim: true,
    },
    organizationLogoUrl: {
      type: String,
      trim: true,
    },
    intendedRoles: {
      type: [String],
      default: [],
    },
    onboardingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    agreementHistory: [
      {
        version: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        representative: String,
        status: {
          type: String,
          enum: ['Executed', 'Archived', 'Expired'],
        },
      },
    ],
    status: {
      type: String,
      enum: ['Active', 'Pending', 'Expired', 'Suspended', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PartnerProfile', PartnerProfileSchema);
