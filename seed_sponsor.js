const mongoose = require('mongoose');
const User = require('./src/models/User');
const Sponsor = require('./src/models/Sponsor');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });

async function seedSponsor() {
  try {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create User
    const email = `sponsor_${Date.now()}@example.com`;
    const user = await User.create({
      firstName: 'Test',
      lastName: 'Sponsor',
      email,
      password: 'password123',
      role: 'sponsor',
      isApproved: true
    });
    console.log(`✅ Created User: ${email}`);

    // 2. Create Sponsor Profile
    const sponsor = await Sponsor.create({
      userId: user._id,
      organizationName: 'Beehives Inc.',
      tier: 'Silver',
      status: 'Active'
    });
    console.log(`✅ Created Sponsor: ${sponsor.organizationName} (${sponsor._id})`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seedSponsor();
