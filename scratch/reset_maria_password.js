require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetMariaPassword() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected!');

  const db = mongoose.connection.db;
  const newPassword = 'Test1234!';

  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  const result = await db.collection('users').updateOne(
    { email: 'mgonzalez@solecitosips.com' },
    { $set: { password: hashed } }
  );

  if (result.modifiedCount === 1) {
    console.log('\n✅ Maria ka password reset ho gaya!');
    console.log('   Email   : mgonzalez@solecitosips.com');
    console.log('   Password: Test1234!');
  } else {
    console.log('❌ User nahi mila ya update nahi hua:', result);
  }

  await mongoose.disconnect();
}

resetMariaPassword().catch(console.error);
