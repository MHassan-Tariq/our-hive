const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ROLES = [
  'visitor',
  'participant',
  'volunteer',
  'donor',
  'sponsor',
  'partner',
  'admin',
];

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      // required: [true, 'Please provide a first name'],
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters'],
    },
    lastName: {
      type: String,
      // required: [true, 'Please provide a last name'],
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allow multiple users with no phone (null/undefined)
      // match: [
      //   /^[+]?[(]?[0-9]{3}[)]?[-s.]?[0-9]{3}[-s.]?[0-9]{4,6}$/,
      //   'Please provide a valid phone number',
      // ],
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'visitor',
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      default: 'Prefer not to say',
      enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say']
    },
    mailingAddress: {
      type: String,
      trim: true,
      maxlength: [200, 'Mailing address cannot be more than 200 characters'],
      // Primarily for In-Kind Donors/Tax Receipts
    },
    preferences: {
      notificationEnabled: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: 'English',
      },
      oneSignalUserId: {
        type: String,
        trim: true,
      },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate and store password reset token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(20).toString('hex');
  // Hash it and set on the model
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // Set 10-minute expiry
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  // Return the unhashed token (sent in email)
  return resetToken;
};

// Method to generate signed JWT token
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ 
    id: this._id, 
    role: this.role,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = mongoose.model('User', UserSchema);
