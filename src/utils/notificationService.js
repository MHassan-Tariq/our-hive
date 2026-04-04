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
      const reason = !user ? 'User not found' : (!user.preferences.notificationEnabled ? 'Notifications disabled' : 'No Player ID');
      console.log(`[Notification] Skip push for ${userId} (${reason}). Stored in database.`);
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
        try {
          const parsed = JSON.parse(responseBody);
          console.log('✅ OneSignal Notification Sent Successfully:', parsed);
        } catch (e) {
          console.log('OneSignal Response:', responseBody);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ OneSignal Request Error:', e);
    });

    req.write(data);
    req.end();

  } catch (error) {
    console.error('sendNotification Error:', error);
  }
};

/**
 * Send a welcome notification to a newly registered user
 * @param {string} userId - ID of the user
 * @param {string} firstName - User's first name
 * @param {string} role - User's role
 */
const sendWelcomeNotification = async (userId, firstName, role) => {
  try {
    const welcomeMessages = {
      'volunteer': `Welcome to Our Hive, ${firstName}!Thank you for signing up to volunteer. Your application is being reviewed by our team`,
      'donor': `Welcome to Our Hive, ${firstName}!Thank you for joining us as a donor. You can now start supporting our community initiatives.`,
      'participant': `Welcome to Our Hive, ${firstName}! We're excited to have you join us. Your account is being reviewed and we'll be in touch soon.`,
      'partner': `Welcome to Our Hive, ${firstName}!Thank you for partnering with us. Your partnership request is being processed.`,
      'sponsor': `Welcome to Our Hive, ${firstName}!Your sponsor account has been successfully activated. You can now start supporting our community.`,
      'visitor': `Welcome to Our Hive, ${firstName}!Thank you for visiting us.`
    };

    const title = 'Welcome to Our Hive!';
    const message = welcomeMessages[role] || `Welcome to Our Hive, ${firstName}!`;
    
    await sendNotification(userId, title, message, 'system', 'checkmark');
    console.log(`✅ Welcome notification sent to ${role} - ${firstName}`);
  } catch (error) {
    console.error('sendWelcomeNotification Error:', error);
  }
};

/**
 * Send a notification to all admin users
 * @param {string} title 
 * @param {string} message 
 */
const notifyAdmins = async (title, message) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id preferences.oneSignalUserId preferences.notificationEnabled');
    
    for (const admin of admins) {
      await sendNotification(admin._id, title, message, 'system', 'info');
    }
  } catch (error) {
    console.error('notifyAdmins Error:', error);
  }
};

module.exports = { sendNotification, sendWelcomeNotification, notifyAdmins };
