require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ role: 'admin' });
  console.log('Admin Users:', JSON.stringify(users, null, 2));
  process.exit();
};

checkAdmin();
