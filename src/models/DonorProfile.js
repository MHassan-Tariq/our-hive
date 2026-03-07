const mongoose = require('mongoose');

const DonorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    monthlyGoal: {
      type: Number,
      default: 80, // percentage as shown in UI (80%)
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
    totalVolunteerHours: {
      type: Number,
      default: 0,
    },
    joinedEvents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
    }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DonorProfile', DonorProfileSchema);
