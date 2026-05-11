const Notification = require('../models/Notification');
const User = require('../models/User');
const https = require('https');
const sendEmail = require('./sendEmail');

/**
 * Send a notification to a specific user
 * @param {string} userId - ID of the user to receive the notification
 * @param {string} title - Title of the notification
 * @param {string} message - Message body of the notification
 * @param {string} type - Enum: ['approval', 'reminder', 'update', 'system']
 * @param {string} iconType - Enum: ['checkmark', 'info']
 * @param {string} htmlMessage - Optional HTML content for email
 */
const sendNotification = async (userId, title, message, type = 'system', iconType = 'info', htmlMessage = null) => {
  try {
    // 1. Save to Database
    await Notification.create({
      userId,
      title,
      message,
      type,
      iconType
    });

    // 2. Fetch User Details (OneSignal ID and Email)
    const user = await User.findById(userId).select('email preferences.oneSignalUserId preferences.notificationEnabled');
    
    if (!user) {
      console.log(`[Notification] User ${userId} not found. Stored in database only.`);
      return;
    }

    // 3. Send Email Notification
    if (user.email) {
      try {
        await sendEmail({
          email: user.email,
          subject: title,
          message: message,
          html: htmlMessage || `<div style="font-family: sans-serif; line-height: 1.5;"><h3>${title}</h3><p>${message}</p></div>`
        });
        console.log(`[Notification] Email sent to ${user.email}`);
      } catch (emailError) {
        console.error(`[Notification] Failed to send email to ${user.email}:`, emailError.message);
      }
    }

    // 4. Send OneSignal Push Notification
    if (user.preferences.notificationEnabled && user.preferences.oneSignalUserId) {
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
    } else {
      const reason = !user.preferences.notificationEnabled ? 'Notifications disabled' : 'No Player ID';
      console.log(`[Notification] Skip push for ${userId} (${reason}).`);
    }

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
