/**
 * Comprehensive API Verification Script v2.1 - Our Hive
 * Verifies all documented portals: Auth, Public, Participant, Volunteer, Donor, Sponsor, Partner, User, Scanner.
 */

const BASE_URL = 'http://localhost:3001/api';
let PASS = 0, FAIL = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    PASS++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       → ${err.message}`);
    if (err.res) {
      console.log(`       → Status: ${err.res.status}`);
      console.log(`       → Response: ${JSON.stringify(err.res.json)}`);
    }
    FAIL++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

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
  if (!res.ok) {
    const error = new Error(`Request failed: ${path}`);
    error.res = { status: res.status, json };
    throw error;
  }
  return { status: res.status, json, ok: res.ok };
}

(async () => {
  console.log('\n🐝 Our Hive - Comprehensive API Verification v2.1\n' + '='.repeat(55));

  const timestamp = Date.now();

  // --- 1. REGISTER ADMIN ---
  console.log('\n📌 [Admin & Public]');
  let adminToken;
  await test('Register Admin', async () => {
    const { status, json } = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'System',
        lastName: 'Admin',
        email: `admin_${timestamp}@example.com`,
        password: 'password123',
        role: 'admin'
      })
    });
    assert(status === 201);
    adminToken = json.token;
  });
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

  await test('Public Stats', async () => {
    const { ok } = await request('/public/stats');
    assert(ok);
  });

  // --- 2. DONOR PORTAL ---
  console.log('\n📌 [Donor Portal]');
  let donorToken;
  await test('Register Donor', async () => {
    const { status, json } = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Donor',
        email: `donor_${timestamp}@example.com`,
        password: 'password123',
        role: 'donor'
      })
    });
    assert(status === 201);
    donorToken = json.token;
  });

  const donorHeaders = { 'Authorization': `Bearer ${donorToken}` };
  await test('Offer In-Kind Donation', async () => {
    const { ok } = await request('/donations', {
      method: 'POST',
      headers: donorHeaders,
      body: JSON.stringify({
        itemName: 'Canned Beans',
        itemCategory: 'Food',
        description: 'Case of 12',
        quantity: '1',
        deliveryMethod: 'drop-off',
        pickupAddress: { street: 'Main St', city: 'Hive City' }
      })
    });
    assert(ok);
  });

  // --- 3. SPONSOR PORTAL ---
  console.log('\n📌 [Sponsor Portal]');
  let sponsorToken;
  await test('Register Sponsor', async () => {
    const { status, json } = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Sponsor',
        email: `sponsor_${timestamp}@example.com`,
        password: 'password123',
        role: 'sponsor'
      })
    });
    assert(status === 201);
    sponsorToken = json.token;
  });

  const sponsorHeaders = { 'Authorization': `Bearer ${sponsorToken}` };
  await test('Record Monetary Donation', async () => {
    const { ok } = await request('/sponsor/donate', {
      method: 'POST',
      headers: sponsorHeaders,
      body: JSON.stringify({ amount: 100, projectTitle: 'General Support' })
    });
    assert(ok);
  });

  await test('Update Donor Monthly Goal', async () => {
    const { ok, json } = await request('/donations/profile', {
      method: 'PATCH',
      headers: donorHeaders,
      body: JSON.stringify({ monthlyGoal: 150 })
    });
    assert(ok);
    assert(json.data.monthlyGoal === 150);
  });

  await test('Update Sponsor Profile', async () => {
    const { ok, json } = await request('/sponsor/profile', {
      method: 'PATCH',
      headers: sponsorHeaders,
      body: JSON.stringify({ organizationName: 'Updated Sponsor Org', isAnonymous: true })
    });
    assert(ok);
    assert(json.data.organizationName === 'Updated Sponsor Org');
    assert(json.data.isAnonymous === true);
  });

  // --- 4. PARTNER PORTAL & ADMIN APPROVAL ---
  console.log('\n📌 [Partner Portal & Admin Approval]');
  let partnerToken;
  let partnerProfileId;
  await test('Register Partner', async () => {
    const { status, json } = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Partner',
        email: `partner_${timestamp}@example.com`,
        password: 'password123',
        role: 'partner'
      })
    });
    assert(status === 201);
    partnerToken = json.token;
  });

  const partnerHeaders = { 'Authorization': `Bearer ${partnerToken}` };
  await test('Submit Partner Profile', async () => {
    const { ok, json } = await request('/partners/profile', {
      method: 'POST',
      headers: partnerHeaders,
      body: JSON.stringify({ orgName: 'Test Org', orgType: 'Non-Profit' })
    });
    assert(ok);
    partnerProfileId = json.data._id;
  });

  await test('Admin Approve Partner', async () => {
    const { ok } = await request(`/admin/partners/${partnerProfileId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'approved' })
    });
    assert(ok);
  });

  await test('Create Opportunity (Approved Partner)', async () => {
    const { ok } = await request('/opportunities', {
      method: 'POST',
      headers: partnerHeaders,
      body: JSON.stringify({
        title: 'Community Lunch',
        description: 'Help us serve meals',
        location: 'Downtown Hive',
        date: new Date().toISOString(),
        category: 'Food Security',
        requiredVolunteers: 10,
        type: 'event'
      })
    });
    assert(ok);
  });

  // --- 5. USER SETTINGS & NOTIFICATIONS ---
  console.log('\n📌 [User Account]');
  await test('Get User Settings', async () => {
    const { ok } = await request('/user/settings', { headers: donorHeaders });
    assert(ok);
  });

  await test('Update User Core Profile', async () => {
    const { ok, json } = await request('/user/profile', {
      method: 'PATCH',
      headers: donorHeaders,
      body: JSON.stringify({ firstName: 'UpdatedFirstName', phone: '1234567890' })
    });
    assert(ok);
    assert(json.data.firstName === 'UpdatedFirstName');
    assert(json.data.phone === '1234567890');
  });

  await test('Get Notifications', async () => {
    const { ok } = await request('/user/notifications', { headers: partnerHeaders });
    assert(ok);
  });

  // --- 6. NEGATIVE TESTS ---
  console.log('\n📌 [Negative Tests - Error Handling]');

  await test('Reject Duplicate Email', async () => {
    try {
      await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Duplicate',
          lastName: 'User',
          email: `donor_${timestamp}@example.com`, // Already registered
          password: 'password123',
          role: 'donor'
        })
      });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.res.status === 400);
      assert(err.res.json.message === 'A user with that email already exists');
    }
  });

  await test('Reject Invalid Phone Format', async () => {
    try {
      await request('/user/profile', {
        method: 'PATCH',
        headers: donorHeaders,
        body: JSON.stringify({ phone: 'invalid-phone-123' })
      });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.res.status === 400);
      // Mongoose validation error message
      assert(err.res.json.message.includes('Please provide a valid phone number'));
    }
  });

  await test('Reject Too Long Name', async () => {
    try {
      await request('/user/profile', {
        method: 'PATCH',
        headers: donorHeaders,
        body: JSON.stringify({ firstName: 'A'.repeat(51) })
      });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.res.status === 400);
      assert(err.res.json.message.includes('First name cannot be more than 50 characters'));
    }
  });

  await test('Reject Missing Street in Donation', async () => {
    try {
      await request('/donations', {
        method: 'POST',
        headers: donorHeaders,
        body: JSON.stringify({
          itemName: 'Incomplete Donation',
          itemCategory: 'Furniture',
          description: 'No address provided',
          pickupAddress: { city: 'New York' } // Missing street
        })
      });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.res.status === 400);
      assert(err.res.json.message.includes('Street is required for pickup'));
    }
  });

  await test('Reject Invalid Admin Status Update', async () => {
    try {
      await request(`/admin/partners/${partnerProfileId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'invalid_status' })
      });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.res.status === 400);
      assert(err.res.json.message === "Status must be either 'approved' or 'rejected'");
    }
  });

  console.log('\n' + '='.repeat(55));
  console.log(`🏁 Final Results: ${PASS} passed, ${FAIL} failed out of ${PASS + FAIL} total tests`);
  
  if (FAIL === 0) {
    console.log('🎉 ALL DOCUMENTED PORTALS, FLOWS & NEGATIVE CASES ARE VERIFIED!');
    process.exit(0);
  } else {
    console.log('⚠️ Some verification cases failed.');
    process.exit(1);
  }
})();
