const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a campaign title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a campaign description'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Please provide an image URL'],
    },
    category: {
      type: String,
      enum: ['Water', 'Education', 'Health', 'Other'],
      required: true,
    },
    externalDonationUrl: {
      type: String,
      required: [true, 'Please provide an external donation link (e.g., Zeffy)'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    goalAmount: {
      type: Number,
      default: 0,
    },
    raisedAmount: {
      type: Number,
      default: 0,
    },
    goalDeadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Campaign', CampaignSchema);
