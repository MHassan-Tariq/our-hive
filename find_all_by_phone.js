require('dotenv').config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const findAllByPhone = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({ phone: '03037772211' });
    console.log(users.map(u => ({ email: u.email, id: u._id })));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

findAllByPhone();
