const mongoose = require('mongoose');

const InKindDonationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    itemCategory: {
      type: String,
      enum: ['Food', 'Clothing', 'Furniture', 'Electronics', 'Other'],
      required: [true, 'Item category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    itemPhotoUrl: {
      type: String,
      trim: true,
    },
    pickupAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      zip: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['offered', 'claimed', 'picked-up', 'delivered'],
      default: 'offered',
    },
    // null until a volunteer claims it
    assignedVolunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InKindDonation', InKindDonationSchema);
