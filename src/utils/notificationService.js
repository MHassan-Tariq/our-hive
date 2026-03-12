const Notification = require('../models/Notification');
const User = require('../models/User');
const https = require('https');

/**
 * Send a notification to a specific user
 * @param {string} userId - ID of the user to receive the notification
 * @param {string} title - Title of the notification
 * @param {string} message - Message body of the notification
 * @param {string} type - Enum: ['approval', 'reminder', 'update', 'system']
 * @param {string} iconType - Enum: ['checkmark', 'info']
 */
const sendNotification = async (userId, title, message, type = 'system', iconType = 'info') => {
  try {
    // 1. Save to Database
    await Notification.create({
      userId,
      title,
      message,
      type,
      iconType
    });

    // 2. Fetch User's OneSignal ID
    const user = await User.findById(userId).select('preferences.oneSignalUserId preferences.notificationEnabled');
    
    if (!user || !user.preferences.notificationEnabled || !user.preferences.oneSignalUserId) {
      console.log(`Notification logged to DB for user ${userId}, but push skipped (muted or no ID)`);
      return;
    }

    // 3. Send via OneSignal REST API
    const data = JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: [user.preferences.oneSignalUserId],
      headings: { en: title },
      contents: { en: message },
    });

    const options = {
      hostname: 'onesignal.com',
      port: 443,
      path: '/api/v1/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        console.log('OneSignal Response:', JSON.parse(responseBody));
      });
    });

    req.on('error', (e) => {
      console.error('OneSignal Request Error:', e);
    });

    req.write(data);
    req.end();

  } catch (error) {
    console.error('sendNotification Error:', error);
  }
};

/**
 * Send a notification to all admin users
 * @param {string} title 
 * @param {string} message 
 */
const notifyAdmins = async (title, message) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('preferences.oneSignalUserId preferences.notificationEnabled');
    
    for (const admin of admins) {
      await sendNotification(admin._id, title, message, 'system', 'info');
    }
  } catch (error) {
    console.error('notifyAdmins Error:', error);
  }
};

module.exports = { sendNotification, notifyAdmins };
