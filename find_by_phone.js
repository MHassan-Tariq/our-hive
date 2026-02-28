require('dotenv').config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const findByPhone = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ phone: '03037772211' });
    console.log(user ? { email: user.email, id: user._id } : 'Not found');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

findByPhone();
