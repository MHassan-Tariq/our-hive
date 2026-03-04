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
      maxlength: [100, 'Full name cannot be more than 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      // match: [
      //   /^[+]?[(]?[0-9]{3}[)]?[-s.]?[0-9]{3}[-s.]?[0-9]{4,6}$/,
      //   'Please provide a valid phone number',
      // ],
    },
    skills: {
      type: [String],
      default: [],
      // e.g. ['Food Preparation', 'Logistics', 'Admin Support', 'Event Housing', 'Driving', 'Social Media']
    },
    availability: {
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: false },
      evenings: { type: Boolean, default: false },
      weekend: { type: Boolean, default: false },
    },
    governmentIdUrl: {
      type: String,
      trim: true,
    },
    drivingLicenseUrl: {
      type: String,
      trim: true,
    },
    agreedToHandbook: {
      type: Boolean,
      default: false,
    },
    profilePictureUrl: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
      // e.g. "New York, NY"
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    totalMeals: {
      type: Number,
      default: 0,
    },
    totalGardens: {
      type: Number,
      default: 0,
    },
    totalImpact: {
      type: String,
      trim: true,
      default: "0 lbs",
      // e.g. "3.2k lbs"
    },
    backgroundCheckStatus: {
      type: String,
      enum: ['Not Started', 'Pending', 'Verified', 'Action Required'],
      default: 'Not Started',
    },
    hoursThisYear: {
      type: Number,
      default: 0,
    },
    nextBadgeGoal: {
      type: Number,
      default: 10, // Default goal for the first badge
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
    badges: [
      {
        name: { type: String, required: true },
        level: { type: String }, // e.g., 'Expert Level'
        earnedAt: { type: Date, default: Date.now },
        badgeId: { type: String, required: true }, // e.g., '#BDG-7729'
        hoursRequired: { type: Number }, // e.g., 15
        imageUrl: { type: String },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for events count
VolunteerProfileSchema.virtual('eventsCount').get(function () {
  return this.joinedOpportunities ? this.joinedOpportunities.length : 0;
});

module.exports = mongoose.model('VolunteerProfile', VolunteerProfileSchema);
