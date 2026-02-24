const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // Can refer to Opportunity or InKindDonation
    refPath: 'serviceType'
  },
  serviceType: {
    type: String,
    required: true,
    enum: ['Opportunity', 'InKindDonation']
  },
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired'],
    default: 'active'
  },
  qrCodeData: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

const ParticipantProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  interests: {
    type: [String],
    default: []
  },
  residenceArea: {
    type: String,
    trim: true
  },
  vouchers: [VoucherSchema]
}, { timestamps: true });

module.exports = mongoose.model('ParticipantProfile', ParticipantProfileSchema);
