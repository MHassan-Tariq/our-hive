require('dotenv').config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({});
    console.log(users.map(u => ({ email: u.email, phone: u.phone, role: u.role })));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listUsers();
