const axios = require('axios');

async function verifyEvents() {
    const API_URL = 'http://localhost:5001/api/public/opportunities';
    try {
        const response = await axios.get(API_URL);
        console.log('Public API Event Count:', response.data.count);
        // Map output to avoid too much noise but show essential info
        const events = response.data.data || [];
        console.log('Events returned:', events.map(e => ({ title: e.title, status: e.status })));
        
        const API_URL_SCHEDULE = 'http://localhost:5001/api/public/schedule?filter=this_week';
        const responseSchedule = await axios.get(API_URL_SCHEDULE);
        console.log('Schedule API Event Count:', responseSchedule.data.count);
        const scheduleEvents = responseSchedule.data.data || [];
        console.log('Schedule events:', scheduleEvents.map(e => ({ title: e.title, status: e.status })));
    } catch (error) {
        console.error('Verification failed:', error.message);
    }
}

verifyEvents();
