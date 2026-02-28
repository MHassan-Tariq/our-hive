const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Load models
const User = require('./models/User');
const VolunteerProfile = require('./models/VolunteerProfile');
const DonorProfile = require('./models/DonorProfile');
const ParticipantProfile = require('./models/ParticipantProfile');
const PartnerProfile = require('./models/PartnerProfile');
const Sponsor = require('./models/Sponsor');
const MonetaryDonation = require('./models/MonetaryDonation');
const InKindDonation = require('./models/InKindDonation');
const Opportunity = require('./models/Opportunity');
const SystemSettings = require('./models/SystemSettings');
const ActivityLog = require('./models/ActivityLog');
const Campaign = require('./models/Campaign');
const Notification = require('./models/Notification');
const VolunteerLog = require('./models/VolunteerLog');

// Connect to DB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`);
    process.exit(1);
  }
};

const resetDatabase = async () => {
  try {
    await connectDB();

    console.log('🕒 Wiping all collections...');
    
    // Wipe all models
    await Promise.all([
      User.deleteMany({}),
      VolunteerProfile.deleteMany({}),
      DonorProfile.deleteMany({}),
      ParticipantProfile.deleteMany({}),
      PartnerProfile.deleteMany({}),
      Sponsor.deleteMany({}),
      MonetaryDonation.deleteMany({}),
      InKindDonation.deleteMany({}),
      Opportunity.deleteMany({}),
      SystemSettings.deleteMany({}),
      ActivityLog.deleteMany({}),
      Campaign.deleteMany({}),
      Notification.deleteMany({}),
      VolunteerLog.deleteMany({})
    ]);

    console.log('✅ All data destroyed');

    console.log('🕒 Creating Admin User...');
    
    // Create Admin User
    // Note: The User model has a pre('save') hook to hash the password
    await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@ourhive.com',
      password: 'password123', 
      phone: '111-111-1111',
      role: 'admin',
      isApproved: true,
    });
    
    console.log('✅ Admin user created: admin@ourhive.com / password123');

    console.log('🕒 Creating Initial System Settings...');
    
    await SystemSettings.create({
      primaryAdminEmail: 'admin@ourhive.com',
      secondaryAdminEmail: 'backup-admin@ourhive.com',
      zeffyDonationLink: 'https://zeffy.com/our-hive/donate',
      zeffyMembershipLink: 'https://zeffy.com/our-hive/membership',
      activeAgreementVersion: 'v1.0.0',
    });

    console.log('✅ System settings initialized');
    console.log('\n🚀 RESET COMPLETE! The system is now in a clean state.');
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error during reset: ${error.message}`);
    process.exit(1);
  }
};

resetDatabase();
