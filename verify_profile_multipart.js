// Our Hive API Profile Multipart Verification Script
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5001/api';
const timestamp = Date.now();

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
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
    console.log('--- Verifying Profile Update (Multipart) ---');

    // 1. Register Admin
    const email = `profile_multi_${timestamp}@example.com`;
    const password = 'password123';
    const adminRes = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Profile',
        lastName: 'Multi',
        email,
        password,
        role: 'admin'
      })
    });
    
    const adminToken = adminRes.json.token;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
    console.log('Admin registered');

    // 2. Update Profile with FormData
    const formData = new FormData();
    formData.append('firstName', 'UpdatedMulti');
    formData.append('lastName', 'Tester');
    formData.append('phone', `001${timestamp % 10000000}`); // Unique phone

    const updateRes = await request('/admin/profile', {
      method: 'PATCH',
      headers: adminHeaders,
      body: formData
    });
    
    if (updateRes.status === 200 && updateRes.json.data.firstName === 'UpdatedMulti') {
      console.log('✅ Profile update (no file) successful');
    } else {
      console.error('❌ Profile update (no file) failed', updateRes.status, updateRes.json);
      process.exit(1);
    }

    console.log('🎉 PROFILE UPDATE (MULTIPART) VERIFIED!');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
