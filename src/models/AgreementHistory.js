const mongoose = require('mongoose');

const AgreementHistorySchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    changeLog: {
      type: String,
      default: 'Regular update',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AgreementHistory', AgreementHistorySchema);
