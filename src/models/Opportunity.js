const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Opportunity title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
    },
    category: {
      type: String,
      trim: true,
      // e.g. 'Food Security', 'Education', 'Health', 'Environment'
    },
    requiredVolunteers: {
      type: Number,
      min: [1, 'At least 1 volunteer required'],
      default: 1,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    // Tracks volunteers who have claimed a spot
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Opportunity', OpportunitySchema);
