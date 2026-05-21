require('dotenv').config();
const http = require('http');
const https = require('https');

// =============================================
// CONFIG — Apna server URL aur credentials yahan daalo
// =============================================
const BASE_URL = 'http://localhost:5002'; // ya production URL

const MARIA_EMAIL    = 'mgonzalez@solecitosips.com';
const MARIA_PASSWORD = 'cofem1234'; // <-- Maria ka actual password daalo

const ADMIN_EMAIL    = '';   // <-- apna admin email daalo
const ADMIN_PASSWORD = '';   // <-- apna admin password daalo

// =============================================
// HELPER — HTTP request
// =============================================
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// =============================================
// MAIN TEST
// =============================================
async function runTest() {
  console.log('\n========================================');
  console.log('   BUG TEST: Partner Event Submission');
  console.log('========================================\n');

  // ── STEP 1: Maria Login ──────────────────────
  console.log('STEP 1: Maria (partner) login kar rahi hai...');
  const mariaLogin = await request('POST', '/api/auth/login', {
    email: MARIA_EMAIL,
    password: MARIA_PASSWORD,
  });

  if (!mariaLogin.body.token) {
    console.log('❌ Maria ka login fail hua:', mariaLogin.body);
    return;
  }

  const mariaToken = mariaLogin.body.token;
  const mariaRole  = mariaLogin.body.data?.role;
  console.log(`✅ Maria logged in! Role: ${mariaRole}`);

  // ── STEP 2: Maria event submit karti hai ─────
  console.log('\nSTEP 2: Maria ek test event submit kar rahi hai...');
  const eventRes = await request('POST', '/api/partners/opportunities', {
    title: '🧪 TEST EVENT — Delete Karna',
    description: 'Yeh sirf testing ke liye hai.',
    location: 'Karachi',
    date: '2026-12-01T10:00:00.000Z',
    time: '10:00 AM',
    endTime: '01:00 PM',
    category: 'Community',
    requiredVolunteers: 5,
    type: 'event',
  }, mariaToken);

  console.log(`Status Code: ${eventRes.status}`);

  if (!eventRes.body.success) {
    console.log('❌ Event create nahi hui:', JSON.stringify(eventRes.body, null, 2));
    console.log('\n⚠️  POSSIBLE CAUSE: Maria ka PartnerProfile "Active" nahi hai.');
    return;
  }

  const eventId = eventRes.body.data?._id;
  const eventStatus = eventRes.body.data?.status;
  console.log(`✅ Event create hui! ID: ${eventId}`);
  console.log(`   Event status: ${eventStatus} (hona chahiye "Pending")`);

  if (eventStatus !== 'Pending') {
    console.log(`⚠️  Status "Pending" nahi hai — bug milega aage!`);
  }

  // ── STEP 3: Admin Login ──────────────────────
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('\n⚠️  Admin credentials set nahi hain — baqi steps skip.');
    console.log(`   Event ID: ${eventId} — Postman se manually approve karo.`);
    return;
  }

  console.log('\nSTEP 3: Admin login kar raha hai...');
  const adminLogin = await request('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (!adminLogin.body.token) {
    console.log('❌ Admin login fail:', adminLogin.body);
    return;
  }

  const adminToken = adminLogin.body.token;
  console.log(`✅ Admin logged in!`);

  // ── STEP 4: Admin Approve karta hai ──────────
  console.log('\nSTEP 4: Admin event approve kar raha hai (Confirmed)...');
  const approveRes = await request('PATCH', `/api/admin/opportunities/${eventId}/status`, {
    status: 'Confirmed',
  }, adminToken);

  console.log(`Status Code: ${approveRes.status}`);
  console.log(`Event status after approval: ${approveRes.body.data?.status}`);

  if (approveRes.body.data?.status === 'Confirmed') {
    console.log('✅ Admin ne approve kiya — status "Confirmed" set hua');
  } else {
    console.log('❌ Approval fail:', JSON.stringify(approveRes.body, null, 2));
  }

  // ── STEP 5: BUG TEST — Calendar mein dikh raha hai? ─
  console.log('\nSTEP 5: BUG CHECK — Public calendar mein event dikh raha hai?');
  const calRes = await request('GET', '/api/public/opportunities');
  const calEvents = calRes.body.data || [];
  const found = calEvents.find(e => e._id === eventId);

  if (found) {
    console.log('✅ Event calendar pe dikh raha hai! Flow sahi kaam kar raha hai.');
  } else {
    console.log('❌ BUG CONFIRMED! Event calendar pe NAHI dikh raha.');
    console.log('   Wajah: opportunityController "Active" filter karta hai lekin');
    console.log('   admin "Confirmed" set karta hai → mismatch!');
  }

  // ── STEP 6: Cleanup ──────────────────────────
  console.log('\nSTEP 6: Test event delete kar raha hun...');
  const delRes = await request('DELETE', `/api/admin/events/${eventId}`, null, adminToken);
  if (delRes.body.success) {
    console.log('✅ Test event deleted.');
  } else {
    console.log(`⚠️  Delete nahi hua — manually delete karna: ID = ${eventId}`);
  }

  console.log('\n========================================');
  console.log('   TEST COMPLETE');
  console.log('========================================\n');
}

runTest().catch(console.error);
