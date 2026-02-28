// Our Hive API Profile Verification Script

const BASE_URL = 'http://localhost:5001/api';
const timestamp = Date.now();

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  let json = {};
  try {
    json = await res.json();
  } catch (e) {}
  return { status: res.status, json, ok: res.ok };
}

(async () => {
  try {
    console.log('--- Verifying Profile Updates ---');

    // 1. Register Admin
    const email = `profile_tester_${timestamp}@example.com`;
    const password = 'password123';
    const adminRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Profile',
        lastName: 'Tester',
        email,
        password,
        role: 'admin'
      })
    });
    
    const adminToken = adminRes.json.token;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
    console.log('Admin registered');

    // 2. Update Profile Name
    const updateRes = await request('/admin/profile', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        firstName: 'UpdatedName',
        lastName: 'Tester',
        phone: '1234567890'
      })
    });
    
    if (updateRes.status === 200 && updateRes.json.data.firstName === 'UpdatedName') {
      console.log('✅ Profile update successful');
    } else {
      console.error('❌ Profile update failed', updateRes.status, updateRes.json);
      process.exit(1);
    }

    // 3. Update Password
    const newPassword = 'newpassword123';
    const passRes = await request('/admin/profile/password', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        currentPassword: password,
        newPassword: newPassword
      })
    });

    if (passRes.status === 200) {
      console.log('✅ Password update successful');
    } else {
      console.error('❌ Password update failed', passRes.status, passRes.json);
      process.exit(1);
    }

    // 4. Verify login with new password
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: newPassword
      })
    });

    if (loginRes.status === 200) {
      console.log('✅ Verified: Login with new password works');
    } else {
      console.error('❌ Error: Login with new password failed');
      process.exit(1);
    }

    console.log('🎉 PROFILE & PASSWORD UPDATES VERIFIED!');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
