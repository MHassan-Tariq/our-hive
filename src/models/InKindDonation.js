const mongoose = require('mongoose');

const InKindDonationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Donation title is required'],
      trim: true,
      maxlength: [150, 'Title cannot be more than 150 characters']
    },
    refId: {
      type: String,
      unique: true,
      // e.g. OH-8821 (legacy internal ref)
    },
    donationId: {
      type: String,
      unique: true,
      // public-facing code like "don-672"
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot be more than 100 characters'],
      // e.g. "10 Cases of Water"
    },
    itemCategory: {
      type: String,
      required: [true, 'Item category is required'],
     },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    quantity: {
      type: String, // e.g. "12 Crates", "40 Liters"
      trim: true,
      maxlength: [50, 'Quantity description cannot be more than 50 characters'],
    },
    image: {
      type: String,
      trim: true,
    },
  pickupAddress: {
      type: String,
      trim: true,
      required: [true, 'Address is required for pickup'],
    },
    estimatedValue: {
      type: String,
      trim: true,
      // e.g. "$50"
    },
    deliveryMethod: {
      type: String,
       default: 'pickup',
    },
    additionalNotes: {
      type: String,
      trim: true,
    },
    petInfo: {
      hasCat: { type: Boolean, default: false },
      hasDog: { type: Boolean, default: false },
    },
    locationName: {
      type: String,
      trim: true,
      // e.g. "Main Warehouse"
    },
    storageDetails: {
      room: { type: String, trim: true },
      rack: { type: String, trim: true },
      shelf: { type: String, trim: true },
      floor: { type: String, trim: true },
    },
    status: {
      type: String,
       default: "offered",
    },
    rejectionReason: {
      type: String,
      trim: true,
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

// Pre-save hook to generate refId and donationId
InKindDonationSchema.pre('save', async function () {
  if (!this.refId) {
    const random = Math.floor(1000 + Math.random() * 9000);
    this.refId = `OH-${random}`;
  }

  if (!this.donationId) {
    // attempt until unique (should rarely loop)
    let code;
    let exists = true;
    while (exists) {
      const num = Math.floor(100 + Math.random() * 900); // three digits
      code = `don-${num}`;
      // check database for collision
      exists = await mongoose.models.InKindDonation.findOne({ donationId: code });
    }
    this.donationId = code;
  }
});

module.exports = mongoose.model('InKindDonation', InKindDonationSchema);
