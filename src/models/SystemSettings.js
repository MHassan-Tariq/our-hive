const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema(
  {
    primaryAdminEmail: {
      type: String,
      trim: true,
      default: 'admin@ourhive.com',
    },
    secondaryAdminEmail: {
      type: String,
      trim: true,
    },
    zeffyDonationLink: {
      type: String,
      trim: true,
      default: 'https://zeffy.com/our-hive/donate',
    },
    zeffyMembershipLink: {
      type: String,
      trim: true,
      default: 'https://zeffy.com/our-hive/membership',
    },
    activeAgreementVersion: {
      type: String,
      trim: true,
      default: 'v1.0.0',
    },
    agreementUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);
