require('dotenv').config({ path: '/Users/user/Desktop/solinovation/our hive/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkPhones = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const users = await User.find({ phone: "" });
    console.log(`Found ${users.length} users with empty phone string ("")`);
    users.forEach(u => {
      console.log(`- ${u.firstName} ${u.lastName} (${u.email}) id: ${u._id}`);
    });
    
    const nullUsers = await User.find({ phone: null });
    console.log(`Found ${nullUsers.length} users with null phone`);

    const undefinedUsers = await User.find({ phone: { $exists: false } });
    console.log(`Found ${undefinedUsers.length} users with no phone field`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkPhones();
