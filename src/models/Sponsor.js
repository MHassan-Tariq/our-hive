const mongoose = require('mongoose');

const TIERS = ['Supporter', 'Bronze', 'Silver', 'Gold'];

const getTier = (amount) => {
  if (amount >= 5000) return 'Gold';
  if (amount >= 1000) return 'Silver';
  if (amount >= 500) return 'Bronze';
  return 'Supporter';
};

const SponsorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    organizationName: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    totalContributed: {
      type: Number,
      default: 0,
      min: 0,
    },

    tier: {
      type: String,
      enum: TIERS,
      default: 'Supporter',
    },

    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Sponsor profile image
    logoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    subscriptionInterval: {
      type: String,
      enum: ['once', 'monthly'],
      default: 'once',
    },

    isMonthlySupporter: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

SponsorSchema.statics.getTier = getTier;

module.exports = mongoose.model('Sponsor', SponsorSchema);