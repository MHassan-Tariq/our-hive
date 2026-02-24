const mongoose = require('mongoose');

const TIERS = ['Supporter', 'Bronze', 'Silver', 'Gold'];

/**
 * Determine tier based on total contributed amount:
 * < $500   → Supporter
 * $500–999 → Bronze
 * $1000–4999 → Silver
 * $5000+   → Gold
 */
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
    },
    totalContributed: {
      type: Number,
      default: 0,
      min: [0, 'Total contributed cannot be negative'],
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
  },
  {
    timestamps: true,
  }
);

SponsorSchema.statics.getTier = getTier;

module.exports = mongoose.model('Sponsor', SponsorSchema);
