const mongoose = require('mongoose');

const PartnerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
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
      // e.g. ['Donating food', 'Hosting events', 'Mentoring youth']
    },
    agreements: {
      isAuthorized: {
        type: Boolean,
        default: false,
      },
      agreedToTerms: {
        type: Boolean,
        default: false,
      },
      understandOperationalControl: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PartnerProfile', PartnerProfileSchema);
