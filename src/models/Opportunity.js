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
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    location: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
    },
    time: {
      type: String, // e.g. "10:00 AM"
      trim: true,
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
    flyerUrl: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['event', 'opportunity'],
      default: 'opportunity',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
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
