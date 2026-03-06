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
      type: String,
      required: [true, 'Time required is required'],
      trim: true,
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
