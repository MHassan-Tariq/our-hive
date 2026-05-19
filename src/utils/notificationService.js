const Notification = require('../models/Notification');
const User = require('../models/User');
const https = require('https');
const sendEmail = require('./sendEmail');

/**
 * Generates a beautiful branded HTML template for emails
 */
const getEmailTemplate = (title, message) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF8F5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #FAF8F5;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(161, 109, 54, 0.05);
      border: 1px solid #F3ECE5;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #b45309, #d97706);
      padding: 32px;
      text-align: center;
    }
    .logo-container {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      padding: 12px;
      margin-bottom: 12px;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header p {
      color: #FFedd5;
      margin: 4px 0 0 0;
      font-size: 14px;
      font-weight: 500;
    }
    .content {
      padding: 40px 32px;
      color: #334155;
      line-height: 1.6;
    }
    .content h2 {
      color: #b45309;
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 28px;
      font-size: 16px;
      color: #475569;
    }
    .cta-button {
      display: inline-block;
      background: #b45309;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(180, 83, 9, 0.15);
    }
    .footer {
      background-color: #FAF8F5;
      padding: 32px;
      text-align: center;
      border-top: 1px solid #F1E7DD;
    }
    .footer p {
      margin: 0;
      color: #64748b;
      font-size: 13px;
      line-height: 1.5;
    }
    .footer-logo {
      font-size: 16px;
      font-weight: 700;
      color: #b45309;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-container">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2ZM12 4.5L19.5 8.25V15.75L12 19.5L4.5 15.75V8.25L12 4.5ZM12 7.5L7.5 9.75V14.25L12 16.5L16.5 14.25V9.75L12 7.5Z" fill="#ffffff"/>
          </svg>
        </div>
        <h1>Our Hive</h1>
        <p>Connecting & Nourishing Communities</p>
      </div>
      <div class="content">
        <h2>${title}</h2>
        <p>${message}</p>
        <a href="https://ourhive-admin.vercel.app" class="cta-button">Open Our Hive Portal</a>
      </div>
      <div class="footer">
        <div class="footer-logo">🐝 Our Hive</div>
        <p>Powered by Mrs'Bs Table</p>
        <p style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
          You received this email because you are registered with Our Hive.<br>
          © 2026 Our Hive. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

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
          html: htmlMessage || getEmailTemplate(title, message)
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

/**
 * Send a notification to all users matching one of the specified roles
 * @param {Array|string} roles - Role or array of roles
 * @param {string} title 
 * @param {string} message 
 * @param {string} type 
 * @param {string} iconType 
 */
const notifyUsersByRole = async (roles, title, message, type = 'system', iconType = 'info') => {
  try {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const users = await User.find({ role: { $in: roleList } }).select('_id');
    for (const user of users) {
      await sendNotification(user._id, title, message, type, iconType);
    }
    console.log(`[Notification] Dispatched role notifications to ${users.length} users with roles: ${roleList.join(', ')}`);
  } catch (error) {
    console.error('notifyUsersByRole Error:', error);
  }
};

module.exports = { sendNotification, sendWelcomeNotification, notifyAdmins, notifyUsersByRole };
