const mongoose = require('mongoose');
const Opportunity = require('../src/models/Opportunity');
const User = require('../src/models/User');
require('dotenv').config();

async function seedTestEvent() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const partner = await User.findOne({ role: 'partner' }) || await User.findOne({ role: 'admin' });
    if (!partner) {
      console.error('No partner or admin user found to host the event.');
      process.exit(1);
    }

    const today = new Date();
    const event = await Opportunity.create({
      partnerId: partner._id,
      title: 'Annual Community Food Drive',
      description: 'Join us for our biggest event of the year! We need enthusiastic volunteers to help sort and pack fresh produce for local families in need.',
      location: 'Community Center Hall',
      specificLocation: '123 Marie Ave, Springfield, IL',
      date: today,
      time: '9:00 AM',
      endTime: '1:00 PM',
      category: 'Food Security',
      requiredVolunteers: 25,
      status: 'Active',
      imageurl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433'
    });

    console.log('Created test event:', event.title, 'with ID:', event._id);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding event:', err);
    process.exit(1);
  }
}

seedTestEvent();
