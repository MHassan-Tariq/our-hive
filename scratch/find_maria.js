require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const mariaUserId = '69f62b0f7123fdc551b86ab0';

  // Check her PartnerProfile
  const profile = await db.collection('partnerprofiles').findOne(
    { userId: new mongoose.Types.ObjectId(mariaUserId) },
    { projection: { orgName: 1, name: 1, status: 1, userId: 1, orgType: 1, intendedRoles: 1, createdAt: 1 } }
  );

  console.log('\n=== MARIA\'s PARTNER PROFILE ===');
  console.log(JSON.stringify(profile, null, 2));

  // Check her submitted events/opportunities
  const events = await db.collection('opportunities').find(
    { partnerId: new mongoose.Types.ObjectId(mariaUserId) },
    { projection: { title: 1, type: 1, status: 1, date: 1, createdAt: 1 } }
  ).toArray();

  console.log('\n=== MARIA\'s SUBMITTED EVENTS ===');
  if (events.length === 0) {
    console.log('No events/opportunities found for Maria');
  } else {
    console.log(JSON.stringify(events, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
