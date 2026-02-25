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
    unique: true,
    sparse: true
  }
}, { timestamps: true });

const ParticipantProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  participantId: {
    type: String,
    unique: true
  },
  interests: {
    type: [String],
    default: []
  },
  housingStatus: {
    type: String,
    enum: ['Housed', 'Unhoused', 'Shelter', 'Transitional Housing', 'At Risk of Homelessness'],
    default: 'Housed'
  },
  address: {
    street: { type: String, trim: true },
    unit: { type: String, trim: true }, // Apartment/Unit (Optional)
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },
  unhousedDetails: {
    crossStreets: { type: String, trim: true },
    nearbyBusiness: { type: String, trim: true },
    landmark: { type: String, trim: true }, // Landmark or Area Description
    city: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },
  householdSize: {
    type: Number,
    default: 1
  },
  childrenCount: {
    type: Number,
    default: 0
  },
  seniorsCount: {
    type: Number,
    default: 0
  },
  petsCount: {
    type: Number,
    default: 0
  },
  dietaryRestrictions: {
    type: [String],
    enum: ['Gluten-Free', 'Vegetarian', 'Vegan', 'Halal', 'Other'],
    default: []
  },
  isVeteran: {
    type: Boolean,
    default: false
  },
  hasDisability: {
    type: Boolean,
    default: false
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say'],
    default: 'Prefer not to say'
  },
  raceEthnicity: {
    type: String,
    trim: true
  },
  primaryLanguage: {
    type: String,
    default: 'English',
    trim: true
  },
  monthlyIncome: {
    type: Number,
    default: 0
  },
  citizenStatus: {
    type: String,
    enum: ['Yes', 'No', 'Prefer not to say'],
    default: 'Prefer not to say'
  },
  assistancePrograms: {
    type: [String],
    enum: ['CalFresh', 'Medi-Cal', 'SSI', 'Other'],
    default: []
  },
  consentToInformationUse: {
    type: Boolean,
    default: false
  },
  intakeStatus: {
    currentStep: { type: Number, default: 1 },
    totalSteps: { type: Number, default: 6 },
    percentage: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ['Action Required', 'Pending Review', 'Completed', 'Rejected'],
      default: 'Action Required'
    }
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'STABLE', 'IN PROGRESS', 'URGENT', 'INACTIVE'],
    default: 'IN PROGRESS'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String,
    select: false
  },
  documents: [
    {
      documentType: { 
        type: String, 
        enum: ['ID', 'Proof of Residence', 'Proof of Income'] 
      },
      fileUrl: String,
      status: { type: String, default: 'pending' },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  vouchers: [VoucherSchema]
}, { timestamps: true });

ParticipantProfileSchema.pre('save', async function() {
  if (!this.participantId) {
    // Generate a random 7 digit string e.g. #8839201
    this.participantId = '#' + Math.floor(1000000 + Math.random() * 9000000).toString();
  }
});

module.exports = mongoose.model('ParticipantProfile', ParticipantProfileSchema);
