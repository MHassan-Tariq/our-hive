const mongoose = require('mongoose');
require('dotenv').config();

const VolunteerProfile = require('./src/models/VolunteerProfile');
const Badge = require('./src/models/Badge');

const parseTimeRequired = (timeRequired) => {
    if (typeof timeRequired === 'number') {
        return timeRequired;
    }
    if (typeof timeRequired === 'string') {
        const match = timeRequired.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
};

const assignBadges = async (profile) => {
    const allBadges = await Badge.find().sort({ timeRequired: 1 });
    console.log('Found allBadges count:', allBadges.length);
    let newBadges = [];

    for (const badge of allBadges) {
        const badgeHoursRequired = parseTimeRequired(badge.timeRequired);
        console.log(`Checking badge: ${badge.title}, hoursRequired: ${badgeHoursRequired}, userHours: ${profile.totalHours}`);

        if (profile.totalHours >= badgeHoursRequired) {
            const hasBadge = profile.badges.some((b) => b.name === badge.title);
            console.log(`User already has badge ${badge.title}? ${hasBadge}`);
            if (!hasBadge) {
                console.log(`Adding badge ${badge.title} to profile`);
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

    const nextBadge = allBadges.find(b => parseTimeRequired(b.timeRequired) > profile.totalHours);
    if (nextBadge) {
        profile.nextBadgeGoal = parseTimeRequired(nextBadge.timeRequired);
    } else {
        profile.nextBadgeGoal = profile.totalHours + 10;
    }

    return newBadges;
};

async function testAssignment() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const userId = '69aaa679b8f299e814e12b6c';
        const profile = await VolunteerProfile.findOne({ userId });

        console.log('Before assignment - Total Hours:', profile.totalHours);
        console.log('Before assignment - Badges:', profile.badges.length);

        const newBadges = await assignBadges(profile);
        console.log('New badges assigned:', newBadges);

        if (newBadges.length > 0) {
            await profile.save();
            console.log('Profile saved!');
        }

        const updatedProfile = await VolunteerProfile.findOne({ userId });
        console.log('After assignment - Badges:', updatedProfile.badges.length);
        console.log('Badge names:', updatedProfile.badges.map(b => b.name));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

testAssignment();
