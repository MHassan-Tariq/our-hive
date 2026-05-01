const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI =
  'mongodb+srv://haroonprojects0:haroonprojects123@cluster0.6xe66ii.mongodb.net/ourhive?retryWrites=true&w=majority&appName=Cluster0';

const EMAIL = 'ourhiveapp@gmail.com';
const NEW_PASSWORD = 'Pass123';

async function resetPassword() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(NEW_PASSWORD, salt);

  const result = await mongoose.connection
    .collection('users')
    .updateOne({ email: EMAIL }, { $set: { password: hashed } });

  if (result.matchedCount === 0) {
    console.log(`❌ No user found with email: ${EMAIL}`);
  } else {
    console.log(`✅ Password updated successfully for ${EMAIL}`);
    console.log(`   New password: ${NEW_PASSWORD}`);
  }

  await mongoose.disconnect();
}

resetPassword().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
