const mongoose = require('mongoose');

const MONGO_URI =
  'mongodb+srv://haroonprojects0:haroonprojects123@cluster0.6xe66ii.mongodb.net/ourhive?retryWrites=true&w=majority&appName=Cluster0';

const EMAIL = 'ourhiveapp@gmail.com';

async function checkAndFixRole() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const user = await mongoose.connection
    .collection('users')
    .findOne({ email: EMAIL }, { projection: { email: 1, role: 1, isApproved: 1 } });

  if (!user) {
    console.log(`❌ No user found with email: ${EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  console.log('Current user state:', JSON.stringify(user, null, 2));

  // Ensure role is admin and isApproved is true
  if (user.role !== 'admin' || !user.isApproved) {
    await mongoose.connection
      .collection('users')
      .updateOne({ email: EMAIL }, { $set: { role: 'admin', isApproved: true } });
    console.log(`✅ Role set to 'admin' and isApproved set to true`);
  } else {
    console.log(`✅ User already has admin role and is approved`);
  }

  await mongoose.disconnect();
}

checkAndFixRole().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
