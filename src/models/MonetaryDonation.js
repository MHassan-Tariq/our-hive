const mongoose = require('mongoose');

const MonetaryDonationSchema = new mongoose.Schema(
  {
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
    },
    projectTitle: {
      type: String,
      required: [true, 'Please provide a project title or description'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide a donation amount'],
      min: [1, 'Amount must be at least 1'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    isMonthly: {
      type: Boolean,
      default: false,
    },
    mealsProvided: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MonetaryDonation', MonetaryDonationSchema);
