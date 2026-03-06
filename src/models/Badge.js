const mongoose = require('mongoose');

const BadgeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Badge title is required'],
      trim: true,
    },
    level: {
      type: String,
      required: [true, 'Badge level is required'],
      trim: true,
    },
    timeRequired: {
      type: Number,
      required: [true, 'Time required is required'],
      min: [0, 'Time required cannot be negative'],
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Badge', BadgeSchema);
