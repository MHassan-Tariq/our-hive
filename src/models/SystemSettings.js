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
    socialLinks: {
      facebook: { type: String, trim: true, default: '' },
      instagram: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
      tiktok: { type: String, trim: true, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);
