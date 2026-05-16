const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from the root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const DonorProfile = require('../src/models/DonorProfile');

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const email = 'contact@mutualrise.org';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User not found: ${email}`);
    } else {
      console.log('User found:');
      console.log(JSON.stringify(user, null, 2));

      const donorProfile = await DonorProfile.findOne({ userId: user._id });
      if (!donorProfile) {
        console.log('DonorProfile NOT found for this user');
      } else {
        console.log('DonorProfile found:');
        console.log(JSON.stringify(donorProfile, null, 2));
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err);
  }
};

checkUser();
