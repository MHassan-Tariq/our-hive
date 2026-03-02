const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config();

const User = require('./src/models/User');
const VolunteerProfile = require('./src/models/VolunteerProfile');

const volunteersToAdd = [
  {
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.jenkins.vol@example.com',
    password: 'password123',
    role: 'volunteer',
    isApproved: true,
    profilePictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
  },
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith.vol@example.com',
    password: 'password123',
    role: 'volunteer',
    isApproved: true,
    profilePictureUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
  }
];

const createVolunteers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    for (const v of volunteersToAdd) {
      // Check if exists
      let user = await User.findOne({ email: v.email });
      if (user) {
        console.log(`User ${v.email} already exists, updating...`);
        user.profilePictureUrl = v.profilePictureUrl;
        user.isApproved = true;
        await user.save();
      } else {
        user = await User.create(v);
        console.log(`User ${v.email} created`);
      }

      // Profile
      let profile = await VolunteerProfile.findOne({ userId: user._id });
      if (!profile) {
        await VolunteerProfile.create({
          userId: user._id,
          fullName: `${v.firstName} ${v.lastName}`,
          skills: ['Community Outreach', 'General Support'],
          backgroundCheckStatus: 'Verified'
        });
        console.log(`Profile for ${v.email} created`);
      } else {
        profile.backgroundCheckStatus = 'Verified';
        await profile.save();
        console.log(`Profile for ${v.email} updated`);
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createVolunteers();
