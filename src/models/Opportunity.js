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
    specificLocation: {
      type: String, // e.g. "Main Entrance, 100 Civic Way"
      trim: true,
    },
    coordinates: {
        lat: { type: Number },
        lng: { type: Number }
    },
    whatToBring: [
      {
        type: String,
        trim: true,
      },
    ],
    date: {
      type: Date,
    },
    time: {
      type: String, // e.g. "10:00 AM"
      trim: true,
    },
    endTime: {
      type: String, // e.g. "1:00 PM"
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
    impactStatement: {
      type: String, // e.g. "Your help today provide 50 meal for local families in need."
      trim: true,
    },
    physicalRequirements: {
      type: String, // e.g. "Must be able to lift 20 lbs and stand for 3 hours."
      trim: true,
    },
    dressCode: {
      type: String, // e.g. "Closed-toe shoes and comfortable clothing required."
      trim: true,
    },
    orientation: {
      type: String, // e.g. "Brief 10- minute training provided ar the start shift"
      trim: true,
    },
    imageurl: {
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
      enum: ['Draft', 'Confirmed', 'Pending', 'Active', 'Inactive', 'Suspended', 'Completed', 'Cancelled', 'Rejected'],
      default: 'Active',
    },
    // Tracks volunteers who have claimed a spot
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Tracks participants/volunteers who physically checked in at the location
    checkedInUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for "Filling Fast" badge (status for the UI)
OpportunitySchema.virtual('statusBadge').get(function () {
  const attendeesCount = this.attendees ? this.attendees.length : 0;
  const attendanceRate = attendeesCount / this.requiredVolunteers;
  if (attendanceRate >= 0.8 && attendanceRate < 1) {
    return 'Filling Fast';
  }
  if (attendanceRate >= 1) {
    return 'Full';
  }
  return null;
});

// Virtual for spots left
OpportunitySchema.virtual('spotsLeft').get(function () {
  const attendeesCount = this.attendees ? this.attendees.length : 0;
  return Math.max(0, this.requiredVolunteers - attendeesCount);
});

// Virtual for duration string e.g. " (3 hours)"
OpportunitySchema.virtual('durationString').get(function () {
  if (!this.time || !this.endTime) return '';
  
  try {
    const parseTime = (t) => {
      const [time, modifier] = t.split(' ');
      let [hours, minutes] = time.split(':');
      if (hours === '12') hours = '00';
      if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
      return new Date(2000, 0, 1, hours, minutes || 0);
    };

    const start = parseTime(this.time);
    const end = parseTime(this.endTime);
    let diff = (end - start) / (1000 * 60 * 60);
    if (diff < 0) diff += 24; // Handle overnight

    return ` (${diff} hour${diff !== 1 ? 's' : ''})`;
  } catch (e) {
    return '';
  }
});

module.exports = mongoose.model('Opportunity', OpportunitySchema);
