const Badge = require('../models/Badge');
const { sendNotification } = require('./notificationService');

// Helper function to parse timeRequired from string or number
const parseTimeRequired = (timeRequired) => {
  if (typeof timeRequired === 'number') {
    return timeRequired;
  }
  if (typeof timeRequired === 'string') {
    // Extract number from strings like "12 Hour", "25 hours", etc.
    const match = timeRequired.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  return 0;
};

// Helper function to assign badges based on total hours
const assignBadges = async (profile) => {
  const allBadges = await Badge.find().sort({ timeRequired: 1 });
  let newBadges = [];

  // Ensure totalHours is rounded to 2 decimal places
  profile.totalHours = Math.round(profile.totalHours * 100) / 100;

  for (const badge of allBadges) {
    // Parse timeRequired to handle both string and number types
    const badgeHoursRequired = parseTimeRequired(badge.timeRequired);

    if (profile.totalHours >= badgeHoursRequired) {
      const hasBadge = profile.badges.some((b) => b.name === badge.title);
      if (!hasBadge) {
        profile.badges.push({
          name: badge.title,
          level: badge.level,
          badgeId: `#BDG-${Math.floor(1000 + Math.random() * 9000)}`,
          hoursRequired: badgeHoursRequired,
          imageUrl: badge.imageUrl,
          earnedAt: new Date(),
        });
        newBadges.push(badge.title);
      }
    }
  }

  // Update nextBadgeGoal to the remaining hours needed for next badge
  const nextBadge = allBadges.find(b => parseTimeRequired(b.timeRequired) > profile.totalHours);
  if (nextBadge) {
    const nextBadgeHours = parseTimeRequired(nextBadge.timeRequired);
    profile.nextBadgeGoal = Math.round((nextBadgeHours - profile.totalHours) * 100) / 100;
  } else {
    profile.nextBadgeGoal = 0; // No more badges to earn
  }

  // OneSignal Notification for each new badge
  for (const badgeTitle of newBadges) {
    await sendNotification(
      profile.userId,
      'New Badge Earned!',
      `Congratulations! You've earned the "${badgeTitle}" badge for your community service.`,
      'update',
      'checkmark'
    );
  }

  return newBadges;
};

module.exports = {
  assignBadges,
  parseTimeRequired,
};