const http = require('http');

// Server port from .env (5002)
const BASE_URL = 'http://localhost:5002';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5002,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
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

async function getAllEvents() {
  console.log('\n========================================');
  console.log('     GET ALL EVENTS — Our Hive API');
  console.log('========================================\n');

  // ── 1. Admin login ────────────────────────────
  console.log('🔐 Admin login ho raha hai...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'ourhiveapp@gmail.com',
    password: 'Pass123',
  });

  if (!loginRes.body.token) {
    console.log('❌ Login fail — admin credentials check karo:');
    console.log(JSON.stringify(loginRes.body, null, 2));
    console.log('\n👉 scratch/get_all_events.js mein email/password update karo\n');
    return;
  }

  const token = loginRes.body.token;
  console.log('✅ Admin logged in!\n');

  // ── 2. GET all events (admin route) ──────────
  console.log('📋 Sare events la raha hun (Admin route)...');
  const eventsRes = await request('GET', '/api/admin/events', null, token);

  if (!eventsRes.body.success) {
    console.log('❌ Events nahi mili:', JSON.stringify(eventsRes.body, null, 2));
    return;
  }

  const events = eventsRes.body.data || [];
  console.log(`✅ Total Events: ${events.length}\n`);

  if (events.length === 0) {
    console.log('⚠️  Koi event nahi hai database mein.');
    return;
  }

  // ── 3. Print summary table ────────────────────
  console.log('─'.repeat(90));
  console.log(
    'No.'.padEnd(5) +
    'Title'.padEnd(35) +
    'Status'.padEnd(15) +
    'Type'.padEnd(15) +
    'Date'
  );
  console.log('─'.repeat(90));

  events.forEach((e, i) => {
    const date = e.date ? new Date(e.date).toLocaleDateString('en-PK') : 'N/A';
    console.log(
      `${(i + 1).toString().padEnd(5)}` +
      `${(e.title || 'Untitled').substring(0, 33).padEnd(35)}` +
      `${(e.status || '—').padEnd(15)}` +
      `${(e.type || '—').padEnd(15)}` +
      date
    );
  });

  console.log('─'.repeat(90));

  // ── 4. Status breakdown ───────────────────────
  const statusCount = events.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Status Breakdown:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`   ${status.padEnd(15)}: ${count}`);
  });

  // ── 5. Maria ke events ───────────────────────
  const MARIA_ID = '69f62b0f7123fdc551b86ab0';
  console.log('\n👩 Maria (COFEM) ke events check kar raha hun...');
  const mariaEvents = events.filter(e => {
    const pid = e.partnerId?._id || e.partnerId;
    return pid && pid.toString() === MARIA_ID;
  });

  if (mariaEvents.length === 0) {
    console.log('   ❌ Maria ka koi event nahi hai database mein.');
    console.log('   (In 4 events mein se koi bhi Maria ka nahi hai)');
  } else {
    console.log(`   ✅ Maria ke ${mariaEvents.length} events mile:`);
    mariaEvents.forEach((e, i) => {
      const date = e.date ? new Date(e.date).toLocaleDateString('en-PK') : 'N/A';
      console.log(`   ${i + 1}. ${e.title} [${e.status}] — ${date}`);
    });
  }

  // ── 6. Also try public calendar route ─────────
  console.log('\n🗓️  Public Calendar (upcoming Active/Confirmed events)...');
  const pubRes = await request('GET', '/api/public/opportunities', null, token);
  const pubEvents = pubRes.body.data || [];
  console.log(`✅ Public calendar pe dikh rahi events: ${pubEvents.length}`);

  if (pubEvents.length > 0) {
    pubEvents.forEach((e, i) => {
      const date = e.date ? new Date(e.date).toLocaleDateString('en-PK') : 'N/A';
      console.log(`   ${i + 1}. ${e.title} [${e.status}] — ${date}`);
    });
  } else {
    console.log('   ⚠️  Koi event public calendar pe nazar nahi aa rahi.');
  }

  console.log('\n========================================\n');
}

getAllEvents().catch(console.error);
