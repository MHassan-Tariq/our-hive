// Our Hive API Delete Verification Script

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
    console.log('--- Verifying Delete Event ---');

    // 1. Register Admin
    const adminRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Delete',
        lastName: 'Tester',
        email: `delete_tester_${timestamp}@example.com`,
        password: 'password123',
        role: 'admin'
      })
    });
    
    if (!adminRes.json.token) {
        console.error('Failed to get admin token');
        process.exit(1);
    }
    
    const adminToken = adminRes.json.token;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // 2. Create Event (Admin)
    const createRes = await request('/admin/events', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Event to Delete #' + timestamp,
        description: 'Testing delete',
        date: '2026-03-15',
        location: 'Test Lab',
        category: 'Test',
        requiredVolunteers: 5,
        status: 'Active'
      })
    });
    
    if (!createRes.json.data || !createRes.json.data._id) {
        console.error('Failed to create event', JSON.stringify(createRes.json));
        process.exit(1);
    }
    
    const eventId = createRes.json.data._id;
    console.log(`Created event: ${eventId}`);

    // 3. Delete Event
    console.log(`Attempting to delete event: ${eventId}`);
    const deleteRes = await request(`/admin/events/${eventId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    console.log(`Delete status: ${deleteRes.status}`);
    console.log(`Delete message: ${deleteRes.json.message}`);

    if (deleteRes.status === 200) {
      console.log('✅ Delete status code 200 OK');
    } else {
      console.error('❌ Delete failed with status ' + deleteRes.status);
      process.exit(1);
    }

    // 4. Verify it's gone
    const getRes = await request(`/admin/events/${eventId}`, {
      method: 'GET',
      headers: adminHeaders
    });
    if (getRes.status === 404) {
      console.log('✅ Verified: Event is definitely gone (404 Not Found)');
    } else {
      console.error('❌ Error: Event still exists! Status: ' + getRes.status);
      process.exit(1);
    }

    console.log('🎉 EVENT DELETE VERIFIED!');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
