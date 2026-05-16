const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');

const checkModerators = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ role: 'moderator' });
    console.log(`Found ${users.length} moderators with role: 'moderator'`);
    if (users.length > 0) {
      users.forEach(u => console.log(` - ${u.firstName} ${u.lastName} (${u.email})`));
    } else {
      console.log('Listing all users and their roles:');
      const allUsers = await User.find({}, 'email role firstName lastName');
      allUsers.forEach(u => console.log(` - ${u.firstName} ${u.lastName} (${u.email}): ${u.role}`));
    }

    const allRoles = await User.distinct('role');
    console.log('Existing roles in database:', allRoles);

    const capitalizedMods = await User.find({ role: 'Moderator' });
    console.log(`Found ${capitalizedMods.length} users with role: 'Moderator' (capitalized)`);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkModerators();
