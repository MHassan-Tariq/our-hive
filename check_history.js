const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const AgreementHistory = require('./src/models/AgreementHistory');

async function checkHistory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await AgreementHistory.countDocuments();
    console.log('Total History Records:', count);
    const records = await AgreementHistory.find().populate('uploadedBy', 'email');
    console.log('Records:', JSON.stringify(records, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkHistory();
