const mongoose = require('mongoose');
const User = require('../our hive/src/models/User'); // Use path relative to the admin workspace
require('dotenv').config({ path: '../our hive/.env' });

async function getToken() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
        console.error('No admin found');
        process.exit(1);
    }
    const token = admin.getSignedJwtToken();
    console.log(token);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getToken();
