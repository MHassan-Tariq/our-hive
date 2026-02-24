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
      required: [true, 'Item category is required'],
      enum: ['Food', 'Clothing', 'Furniture', 'Electronics', 'Other'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    quantity: {
      type: String, // e.g. "12 Crates", "40 Liters"
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
      enum: ['offered', 'claimed', 'in-transit', 'picked-up', 'delivered'],
      default: 'offered',
    },
    assignedVolunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pickupDate: {
      type: Date,
    },
    deliveredDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InKindDonation', InKindDonationSchema);
