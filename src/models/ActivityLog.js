const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'Submission Approved',
        'Profile Updated',
        'New Volunteer Interest',
        'New Pickup Assigned',
        'New Participant Intake',
        'Volunteer Hours Logged',
        'New In-Kind Donation',
        'New Monetary Donation',
        'New Partner Registration',
      ],
    },
    content: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedModel: {
      type: String,
      enum: [
        'Opportunity',
        'InKindDonation',
        'PartnerProfile',
        'MonetaryDonation',
        'Sponsor',
        'DonorProfile',
        'ParticipantProfile',
        'VolunteerProfile',
      ],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
