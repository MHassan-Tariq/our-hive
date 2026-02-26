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

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

const importData = async () => {
  try {
    // 1. Wipe existing data
    await User.deleteMany();
    await VolunteerProfile.deleteMany();
    await DonorProfile.deleteMany();
    await ParticipantProfile.deleteMany();
    await PartnerProfile.deleteMany();

    console.log('✅ Existing data destroyed...');

    // 2. Create Admin User
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@ourhive.com',
      password: 'password123', // Will be hashed by pre-save middleware
      phone: '111-111-1111',
      role: 'admin',
      isApproved: true,
    });
    console.log('✅ Admin user created');

    // 3. Create Volunteer User & Profile
    const volunteerUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'volunteer@ourhive.com',
      password: 'password123',
      phone: '222-222-2222',
      role: 'volunteer',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
    });

    await VolunteerProfile.create({
      userId: volunteerUser._id,
      fullName: 'John Doe',
      phone: '222-222-2222',
      skills: ['Food Preparation', 'Logistics', 'Driving'],
      availability: {
        morning: true,
        afternoon: false,
        evenings: true,
        weekend: true,
      },
      location: 'New York, NY',
      totalDeliveries: 15,
      totalMeals: 450,
      totalGardens: 2,
      totalImpact: '1.2k lbs',
      hoursThisYear: 120,
      totalHours: 250,
      nextBadgeGoal: 50,
      backgroundCheckStatus: 'Verified',
      badges: [
        {
          name: 'Bronze Volunteer',
          level: 'Beginner',
          badgeId: '#BDG-1001',
          hoursRequired: 10,
        },
        {
          name: 'Silver Volunteer',
          level: 'Intermediate',
          badgeId: '#BDG-1002',
          hoursRequired: 50,
        }
      ]
    });
    console.log('✅ Volunteer user & profile created');

    // 4. Create Donor User & Profile
    const donorUser = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'donor@ourhive.com',
      password: 'password123',
      phone: '333-333-3333',
      role: 'donor',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/women/1.jpg',
    });

    await DonorProfile.create({
      userId: donorUser._id,
      monthlyGoal: 85, // 85%
      totalDonations: 1250.50,
      totalVolunteerHours: 15,
    });
    console.log('✅ Donor user & profile created');

    // 5. Create Participant User & Profile
    const participantUser = await User.create({
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'participant@ourhive.com',
      password: 'password123',
      phone: '444-444-4444',
      role: 'participant',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/men/2.jpg',
    });

    await ParticipantProfile.create({
      userId: participantUser._id,
      participantId: '#1234567',
      interests: ['Food Assistance', 'Housing Support'],
      housingStatus: 'Transitional Housing',
      address: {
        street: '123 Main St',
        unit: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
      },
      householdSize: 3,
      childrenCount: 2,
      dietaryRestrictions: ['Vegetarian'],
      primaryLanguage: 'English',
      accountStatus: 'ACTIVE',
      intakeStatus: {
        currentStep: 6,
        totalSteps: 6,
        percentage: 100,
        status: 'Completed',
      }
    });
    console.log('✅ Participant user & profile created');

    // 6. Create Partner User & Profile
    const partnerUser = await User.create({
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'partner@ourhive.com',
      password: 'password123',
      phone: '555-555-5555',
      role: 'partner',
      isApproved: true,
    });

    await PartnerProfile.create({
      userId: partnerUser._id,
      orgName: 'Community Food Bank',
      orgType: 'Non-Profit',
      address: '456 Charity Lane, New York, NY 10002',
      website: 'https://example-foodbank.org',
      organizationLogoUrl: 'https://ui-avatars.com/api/?name=Community+Food+Bank&background=random',
      intendedRoles: ['Donating food', 'Hosting events'],
      status: 'approved',
      agreements: {
        isAuthorized: true,
        agreedToTerms: true,
        understandOperationalControl: true,
      }
    });
    console.log('✅ Partner user & profile created');

    console.log('✅ Data Imported Successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error with import: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await User.deleteMany();
    await VolunteerProfile.deleteMany();
    await DonorProfile.deleteMany();
    await ParticipantProfile.deleteMany();
    await PartnerProfile.deleteMany();

    console.log('✅ Data Destroyed Successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error with destruction: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
