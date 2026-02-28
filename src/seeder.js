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
    await Sponsor.deleteMany();
    await MonetaryDonation.deleteMany();
    await InKindDonation.deleteMany();
    await Opportunity.deleteMany();
    await SystemSettings.deleteMany();

    console.log('✅ Existing data destroyed...');

    // 2. Create Admin User
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@ourhive.com',
      password: 'password123', 
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
        { name: 'Bronze Volunteer', level: 'Beginner', badgeId: '#BDG-1001', hoursRequired: 10 },
        { name: 'Silver Volunteer', level: 'Intermediate', badgeId: '#BDG-1002', hoursRequired: 50 }
      ]
    });
    console.log('✅ Volunteer user & profile created');

    // 4. Create Partner User & Profile (Sarah Jenkins - Tech Summit)
    const partnerUser1 = await User.create({
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'jenkins@techsummit.org',
      password: 'password123',
      phone: '444-444-4444',
      role: 'partner',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
    });

    await PartnerProfile.create({
      userId: partnerUser1._id,
      partnerId: 'PG-88291',
      orgName: 'Tech Summit Corp',
      orgType: 'Non-Profit',
      legalEntityName: 'Tech Summit International Inc.',
      registrationNumber: 'REG-552910',
      description: 'Advancing Karachi through tech and innovation events.',
      headquarters: 'Karachi, Pakistan',
      taxStatus: 'Tax Exempt (Section 8)',
      companyOverview: 'Founded in 2018, we host the largest annual tech gathering in Pakistan.',
      address: 'I.I. Chundrigar Rd, Karachi',
      website: 'https://techsummit.pk',
      onboardingScore: 92,
      agreementHistory: [
        {
          version: 'v2.4.0',
          timestamp: new Date('2023-09-15'),
          representative: 'Sarah Jenkins',
          status: 'Executed'
        }
      ],
      status: 'Active',
    });

    // 5. Create Events for Sarah
    await Opportunity.create([
      {
        partnerId: partnerUser1._id,
        title: 'Tech Summit 2024',
        description: 'Manage and monitor all scheduled events across your organization.',
        location: 'San Francisco, CA',
        date: new Date('2024-10-15'),
        time: '09:00 AM',
        status: 'Confirmed',
        type: 'event',
        category: 'Technology'
      },
      {
        partnerId: partnerUser1._id,
        title: 'Indie Music Festival',
        description: 'An evening of underground music and arts.',
        location: 'Austin, TX',
        date: new Date('2024-11-02'),
        time: '02:00 PM',
        status: 'Pending',
        type: 'event',
        category: 'Arts & Culture'
      },
      {
        partnerId: partnerUser1._id,
        title: 'SaaS Product Launch',
        description: 'Launch event for our new logistics platform.',
        location: 'New York, NY',
        date: new Date('2024-12-10'),
        time: '11:00 AM',
        status: 'Confirmed',
        type: 'event',
        category: 'Business'
      },
      {
        partnerId: partnerUser1._id,
        title: 'Winter Charity Gala',
        description: 'Annual formal fundraiser for local community projects.',
        location: 'Chicago, IL',
        date: new Date('2025-01-20'),
        time: '06:00 PM',
        status: 'Draft',
        type: 'event',
        category: 'Community'
      }
    ]);
    console.log('✅ Partner 1 (Sarah) & Events created');

    // 6. Create another Partner (Sarah Williams - Food Bank)
    const partnerUser2 = await User.create({
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'partner@ourhive.com',
      password: 'password123',
      phone: '555-555-5555',
      role: 'partner',
      isApproved: true,
    });

    await PartnerProfile.create({
      userId: partnerUser2._id,
      orgName: 'Community Food Bank',
      orgType: 'Non-Profit',
      address: '456 Charity Lane, New York, NY 10002',
      website: 'https://example-foodbank.org',
      organizationLogoUrl: 'https://ui-avatars.com/api/?name=Community+Food+Bank&background=random',
      intendedRoles: ['Donating food', 'Hosting events'],
      status: 'Active',
    });
    console.log('✅ Partner 2 (Williams) created');

    // 7. Create Donor User & Profile
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
      monthlyGoal: 85,
      totalDonations: 1250.50,
      totalVolunteerHours: 15,
    });
    console.log('✅ Donor user & profile created');

    // 8. Create Participant User & Profile
    const participantUser = await User.create({
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'participant@ourhive.com',
      password: 'password123',
      phone: '444-444-5555',
      role: 'participant',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/men/2.jpg',
    });

    await ParticipantProfile.create({
      userId: participantUser._id,
      participantId: '#1234567',
      interests: ['Food Assistance', 'Housing Support'],
      housingStatus: 'Transitional Housing',
      address: { street: '123 Main St', unit: 'Apt 4B', city: 'New York', state: 'NY', zipCode: '10001' },
      householdSize: 3,
      childrenCount: 2,
      dietaryRestrictions: ['Vegetarian'],
      primaryLanguage: 'English',
      accountStatus: 'ACTIVE',
      intakeStatus: { currentStep: 6, totalSteps: 6, percentage: 100, status: 'Completed' }
    });
    console.log('✅ Participant user & profile created');

    // 9. Create Sponsor Users & Profiles
    const sponsor1User = await User.create({
      firstName: 'Robert',
      lastName: 'Miller',
      email: 'robert@millerconstruction.com',
      password: 'password123',
      phone: '555-987-6543',
      role: 'sponsor',
      isApproved: true,
      profilePictureUrl: 'https://randomuser.me/api/portraits/men/4.jpg',
    });

    await Sponsor.create({
      userId: sponsor1User._id,
      organizationName: 'Miller Construction',
      totalContributed: 500,
      tier: 'Bronze',
      status: 'Active',
    });

    await MonetaryDonation.create({
      sponsorId: sponsor1User._id,
      amount: 500,
      status: 'completed',
      projectTitle: 'Beehive Construction Materials',
      createdAt: new Date('2023-11-01'),
    });
    console.log('✅ Sponsor created');

    // 10. Initial System Settings
    await SystemSettings.create({
      primaryAdminEmail: 'admin@ourhive.com',
      secondaryAdminEmail: 'backup-admin@ourhive.com',
      zeffyDonationLink: 'https://zeffy.com/our-hive/donate',
      zeffyMembershipLink: 'https://zeffy.com/our-hive/membership',
      activeAgreementVersion: 'v2.4.0 (Sept 2023)',
    });
    console.log('✅ Initial system settings created');

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
    await Sponsor.deleteMany();
    await MonetaryDonation.deleteMany();
    await InKindDonation.deleteMany();
    await Opportunity.deleteMany();
    await SystemSettings.deleteMany();

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
