const mongoose = require('mongoose');

const VolunteerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
      // e.g. ['Driving', 'First Aid', 'Cooking', 'Teaching']
    },
    availability: {
      weekdays: { type: Boolean, default: false },
      weekends: { type: Boolean, default: false },
    },
    totalHours: {
      type: Number,
      default: 0,
      min: [0, 'Total hours cannot be negative'],
    },
    joinedOpportunities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Opportunity',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('VolunteerProfile', VolunteerProfileSchema);
