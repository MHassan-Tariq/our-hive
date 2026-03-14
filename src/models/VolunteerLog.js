const mongoose = require('mongoose');

const VolunteerLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // e.g. "09:00 AM"
      required: true,
    },
    endTime: {
      type: String, // e.g. "01:00 PM"
      required: true,
    },
    category: {
      type: String, // e.g. "Food Sorting"
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    hoursLogged: {
      type: Number,
      required: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending' // Admin must approve hours by default
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('VolunteerLog', VolunteerLogSchema);
