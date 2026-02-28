const API_URL = 'http://localhost:5001/api';
let token = '';

async function login() {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ourhive.com',
        password: 'password123'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    token = data.token;
    console.log('✅ Logged in as admin');
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    process.exit(1);
  }
}

async function verifySponsorActions() {
  try {
    // 1. Get all sponsors
    const listRes = await fetch(`${API_URL}/admin/sponsors`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const sponsors = listData.data;
    if (!sponsors || sponsors.length === 0) {
      console.log('⚠️ No sponsors found to test with.');
      return;
    }
    const testSponsor = sponsors[0];
    const sponsorId = testSponsor._id;
    console.log(`Testing with Sponsor: ${testSponsor.organizationName} (${sponsorId})`);

    // 2. Update sponsor
    const newName = (testSponsor.organizationName || 'Sponsor') + ' - Updated';
    const updateRes = await fetch(`${API_URL}/admin/sponsors/${sponsorId}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationName: newName,
        status: 'Inactive'
      })
    });
    const updateData = await updateRes.json();
    console.log('✅ Update successful:', updateData.success);
    if (!updateData.data || updateData.data.organizationName !== newName) {
      console.error('❌ Update name mismatch! Expected:', newName, 'Got:', updateData.data?.organizationName);
    } else {
      console.log('✅ Update name verified');
    }

    // 3. Delete sponsor
    const deleteRes = await fetch(`${API_URL}/admin/sponsors/${sponsorId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const deleteData = await deleteRes.json();
    console.log('✅ Delete successful:', deleteData.success);

    // 4. Verify deletion
    const verifyRes = await fetch(`${API_URL}/admin/sponsors/${sponsorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (verifyRes.status === 404) {
      console.log('✅ Deletion verified (404 Not Found)');
    } else {
      console.error('❌ Unexpected status after deletion:', verifyRes.status);
    }

  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  }
}

async function run() {
  await login();
  await verifySponsorActions();
}

run();
