const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('./src/models/Notification');

dotenv.config();

const userId = '69b252eba6baf95cac9545f8';

const notifications = [
  {
    userId,
    title: 'Welcome to Our Hive!',
    message: 'Thank you for joining our community. Start exploring opportunities now.',
    type: 'system',
    iconType: 'info',
    isRead: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
  },
  {
    userId,
    title: 'Profile Approved',
    message: 'Your registration has been verified and approved by the admin.',
    type: 'approval',
    iconType: 'checkmark',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000) // Slightly more than 24h ago
  },
  {
    userId,
    title: 'New Event: Community Clean-up',
    message: 'A new volunteer opportunity matches your interests. Check it out!',
    type: 'update',
    iconType: 'info',
    isRead: false,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12h ago
  },
  {
    userId,
    title: 'Donation Verified',
    message: 'Your recent donation of $50 has been successfully processed.',
    type: 'approval',
    iconType: 'checkmark',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2h ago
  },
  {
    userId,
    title: 'Meeting Reminder',
    message: 'Don\'t forget our orientation session tomorrow at 10:00 AM.',
    type: 'reminder',
    iconType: 'info',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30m ago
  }
];

const seedNotifications = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // Clear existing notifications for this user if you want, or just add new ones
    // await Notification.deleteMany({ userId });

    await Notification.insertMany(notifications);
    console.log('Notifications seeded successfully for user:', userId);

    process.exit();
  } catch (error) {
    console.error('Error seeding notifications:', error);
    process.exit(1);
  }
};

seedNotifications();
