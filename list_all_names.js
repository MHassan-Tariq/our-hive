require('dotenv').config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const listAll = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({});
    console.log(JSON.stringify(users.map(u => ({ 
      email: u.email, 
      firstName: u.firstName, 
      lastName: u.lastName, 
      phone: u.phone 
    })), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listAll();
