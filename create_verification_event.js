const mongoose = require('mongoose');
const User = require('./src/models/User');
const Opportunity = require('./src/models/Opportunity');
require('dotenv').config();

async function createEvent() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin found');
      process.exit(1);
    }

    const today = new Date();
    const event = await Opportunity.create({
      partnerId: admin._id,
      title: 'Annual Community Food Drive',
      description: 'Join us for our biggest event of the year!',
      location: 'Community Center Hall',
      specificLocation: '123 Marie Ave, Springfield, IL',
      date: today,
      time: '9:00 AM',
      endTime: '11:59 PM', // Make it long enough to be "Open Now"
      category: 'Food Security',
      requiredVolunteers: 25,
      status: 'Confirmed'
    });

    console.log('SUCCESS: Created event with ID:', event._id);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createEvent();
