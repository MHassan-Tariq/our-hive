# OneSignal Integration Guide

This document explains how to set up and use OneSignal push notifications in Our Hive application.

## Overview

The application has been enhanced with OneSignal integration to send push notifications to users upon signup and other key events. The notifications are:
- Saved to the database for in-app viewing
- Sent as push notifications via OneSignal REST API
- Customized based on user role and action

## Setup Instructions

### 1. OneSignal Account Setup

1. Go to [OneSignal.com](https://onesignal.com)
2. Create a free account
3. Create a new app for "Our Hive"
4. Select your platform (Web, iOS, Android, etc.)
5. Follow the platform-specific setup instructions

### 2. Environment Variables

Add the following to your `.env` file:

```env
# OneSignal (Push Notifications)
ONESIGNAL_APP_ID=your_app_id_here
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

**Where to find these credentials:**
- **ONESIGNAL_APP_ID**: OneSignal Dashboard → Settings → Keys & IDs
- **ONESIGNAL_REST_API_KEY**: OneSignal Dashboard → Settings → Keys & IDs (REST API Key)

### 3. Client-Side Setup

When users register or log in, your frontend app should:

1. Initialize OneSignal SDK in your app
2. Get the player ID from OneSignal
3. Send the `playerId` to the backend in the signup request

**Example for Flutter/Mobile:**
```dart
// Initialize OneSignal
OneSignal.setAppId("your_app_id");

// Get Player ID
String? playerId = await OneSignal.User.pushSubscription.id;

// Send to backend with playerId in request
```

**Example for Web:**
```javascript
// Initialize OneSignal
OneSignal.init({
  appId: "YOUR_ONESIGNAL_APP_ID",
});

// When user registers, send the player ID
const playerId = await OneSignal.getDeviceState().subscriptionId;
```

## API Changes

### Signup Endpoints Updated

All signup endpoints now accept an optional `playerId` field:

#### Generic Register
```
POST /api/auth/register
Body: {
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phone: string,
  role: 'visitor' | 'sponsor' | 'donor',
  mailingAddress: string (optional),
  playerId: string (optional) // New!
}
```

#### Volunteer Register
```
POST /api/auth/volunteer-register
Body: {
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phone: string,
  skills: string[],
  availability: object,
  mailingAddress: string (optional),
  playerId: string (optional) // New!
}
```

#### Participant Register
```
POST /api/auth/participant-register
Body: {
  fullName: string,
  email: string,
  password: string,
  phone: string,
  mailingAddress: string (optional),
  playerId: string (optional) // New!
}
```

#### Partner Register
```
POST /api/auth/partner-register
Body: {
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phone: string,
  orgName: string,
  orgType: string,
  orgAddress: string,
  website: string (optional),
  intendedRoles: string[],
  playerId: string (optional) // New!
}
```

## Welcome Notifications

When a user signs up, they automatically receive a personalized welcome notification:

### Notification Examples by Role

**Volunteer:**
```
Title: "Welcome to Our Hive!"
Message: "Welcome to Our Hive, [FirstName]! 🙌 Thank you for signing up to volunteer. Your application is being reviewed by our team. We'll notify you once it's approved."
```

**Donor:**
```
Title: "Welcome to Our Hive!"
Message: "Welcome to Our Hive, [FirstName]! 💝 Thank you for joining us as a donor. You can now start supporting our community initiatives."
```

**Participant:**
```
Title: "Welcome to Our Hive!"
Message: "Welcome to Our Hive, [FirstName]! 🌟 We're excited to have you join us. Your account is being reviewed and we'll be in touch soon."
```

**Partner:**
```
Title: "Welcome to Our Hive!"
Message: "Welcome to Our Hive, [FirstName]! 🤝 Thank you for partnering with us. Your partnership request is being processed."
Message 2 (specific): "Your partnership registration for '[OrgName]' has been submitted successfully. Our team will review your application and get back to you soon."
```

**Sponsor:**
```
Title: "Welcome to Our Hive!"
Message: "Welcome to Our Hive, [FirstName]! 🚀 Your sponsor account has been successfully activated. You can now start supporting our community."
```

## Code Architecture

### Files Modified

1. **`.env.example`** - Added OneSignal environment variables
2. **`src/utils/notificationService.js`** - Enhanced with:
   - Improved `sendNotification()` function with better error handling
   - New `sendWelcomeNotification()` function for signup
   - Enhanced `notifyAdmins()` function

3. **`src/controllers/authController.js`** - Updated all signup functions:
   - Added `playerId` parameter handling
   - Store `oneSignalUserId` in user preferences
   - Call `sendWelcomeNotification()` after signup

### Notification Flow

```
User Signs Up
    ↓
playerId sent to backend
    ↓
User created with oneSignalUserId stored
    ↓
sendWelcomeNotification() called
    ↓
├─ Notification saved to Notification collection (DB)
└─ Push notification sent via OneSignal API
    ↓
User receives notification on device
```

## Database Structure

### User Model
```javascript
{
  // ... other fields
  preferences: {
    notificationEnabled: boolean (default: true),
    language: string (default: 'English'),
    oneSignalUserId: string // Player ID from OneSignal
  }
}
```

### Notification Model
```javascript
{
  userId: ObjectId,
  title: string,
  message: string,
  type: enum ['approval', 'reminder', 'update', 'system'],
  iconType: enum ['checkmark', 'info'],
  createdAt: timestamp
}
```

## Notification Service Functions

### `sendNotification(userId, title, message, type, iconType)`
Sends a notification to a specific user.

**Parameters:**
- `userId` (string): User ID to receive notification
- `title` (string): Notification title
- `message` (string): Notification message body
- `type` (string): Notification type - 'approval', 'reminder', 'update', or 'system' (default: 'system')
- `iconType` (string): Icon type - 'checkmark' or 'info' (default: 'info')

**Returns:** Promise (resolves when notification is sent/logged)

**Example:**
```javascript
const { sendNotification } = require('../utils/notificationService');

await sendNotification(
  userId,
  'Account Approved',
  'Congratulations! Your account has been approved.',
  'approval',
  'checkmark'
);
```

### `sendWelcomeNotification(userId, firstName, role)`
Sends a personalized welcome notification based on user role.

**Parameters:**
- `userId` (string): User ID to receive notification
- `firstName` (string): User's first name for personalization
- `role` (string): User role - 'volunteer', 'donor', 'participant', 'partner', 'sponsor', or 'visitor'

**Returns:** Promise

**Example:**
```javascript
const { sendWelcomeNotification } = require('../utils/notificationService');

await sendWelcomeNotification(user._id, user.firstName, 'volunteer');
```

### `notifyAdmins(title, message)`
Sends a notification to all admin users.

**Parameters:**
- `title` (string): Notification title
- `message` (string): Notification message body

**Returns:** Promise

**Example:**
```javascript
const { notifyAdmins } = require('../utils/notificationService');

await notifyAdmins(
  'New User Registration',
  'A new user has registered in the system.'
);
```

## Logging and Debugging

All notification operations are logged to the console for debugging:

```bash
# Successful notification
✅ OneSignal Notification Sent Successfully: { ... response ... }
✅ Welcome notification sent to volunteer - John

# Skipped notification (user has disabled notifications)
Notification logged to DB for user [userId], but push skipped (muted or no ID)

# Error
❌ OneSignal Request Error: [error details]
```

## Troubleshooting

### Notifications not being sent

1. **Check environment variables:**
   ```bash
   echo $ONESIGNAL_APP_ID
   echo $ONESIGNAL_REST_API_KEY
   ```

2. **Verify playerId is being sent:**
   - Check request logs to see if `playerId` is included in signup request
   - Verify OneSignal SDK is initialized on frontend

3. **Check user preferences:**
   ```javascript
   const user = await User.findById(userId);
   console.log(user.preferences);
   // Should have notificationEnabled: true and a valid oneSignalUserId
   ```

4. **Check OneSignal dashboard:**
   - Verify app is active
   - Check API keys are correct
   - Look at OneSignal's activity log for failed requests

5. **Check database:**
   - Verify notifications are being saved to Notification collection
   - Check user's oneSignalUserId is stored correctly

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Authorization Error | Check ONESIGNAL_REST_API_KEY is correct |
| 400 Bad Request | Verify ONESIGNAL_APP_ID is correct format |
| User not receiving notifications | Ensure playerId is sent during signup; check if notifications are enabled in user preferences |
| Notifications in DB but not pushed | OneSignal SDK might not be initialized on client or player ID is invalid |

## Testing

### Manual Testing with cURL

```bash
curl --location 'https://onesignal.com/api/v1/notifications' \
--header 'Authorization: Basic YOUR_REST_API_KEY' \
--header 'Content-Type: application/json' \
--data '{
    "app_id": "YOUR_APP_ID",
    "include_player_ids": ["PLAYER_ID_FROM_USER"],
    "headings": {"en": "Test Notification"},
    "contents": {"en": "This is a test notification"}
}'
```

### API Testing

Use Postman to test signup endpoints:

1. Create new POST request to `http://localhost:3001/api/auth/volunteer-register`
2. Add headers:
   - `Content-Type: application/json`
3. Add body:
   ```json
   {
     "firstName": "Test",
     "lastName": "User",
     "email": "test@example.com",
     "password": "password123",
     "phone": "1234567890",
     "skills": ["Teaching"],
     "availability": {"morning": true, "afternoon": false, "evenings": false, "weekend": true},
     "playerId": "test-player-id-12345"
   }
   ```
4. Send and check:
   - Response status (should be 201)
   - Check Notification collection in MongoDB
   - Check OneSignal dashboard for sent notifications
   - Look at server console logs

## Best Practices

1. **Always send playerId during signup** - This ensures users can receive notifications immediately after registration

2. **Validate playerId format** - OneSignal player IDs are typically 36-character UUIDs

3. **Handle notification failures gracefully** - Notifications are non-critical; failures should not prevent signup

4. **Test with real applications** - OneSignal SDK setup must be correct on the client for testing

5. **Monitor notification delivery** - Use OneSignal dashboard to track delivery rates and user engagement

6. **Respect user preferences** - Check `notificationEnabled` before sending notifications

## Future Enhancements

Potential improvements to the notification system:

- [ ] Scheduled notifications for events/reminders
- [ ] Notification preferences per user (notification categories)
- [ ] Rich notifications with images and actions
- [ ] In-app notification badge counter
- [ ] Notification analytics and tracking
- [ ] Email fallback for users without push subscriptions
- [ ] Segment-based notifications (targeting specific user groups)
- [ ] Localization of notification messages
- [ ] Notification templates management

## Support

For issues with OneSignal specifically, visit:
- [OneSignal Documentation](https://documentation.onesignal.com/)
- [OneSignal Support](https://onesignal.com/support)

For issues with Our Hive implementation, check:
- Server console logs
- Database Notification collection
- OneSignal Activity Feed in dashboard
