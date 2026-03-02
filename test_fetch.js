const mongoose = require('mongoose');
const User = require('./src/models/User.js');
require('dotenv').config();

async function testFetch() {
  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.findOne({ role: 'admin' });
  const token = admin.getSignedJwtToken();
  const url = 'http://localhost:5001/api/admin/community-partners';
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.log('Error:', err.message);
  }
  process.exit(0);
}
testFetch();
