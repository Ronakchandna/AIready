// Adds demo users to the leaderboard. Run: npm run seed  (uses DATABASE_URL from .env)
require('dotenv').config();
const db = require('./db');
const User = require('./models/User');

const demoUsers = [
    { name: 'Alex Rivera', email: 'alex@demo.airesume', globalRankScore: 920, tier: 'Diamond', categoryTrack: 'Software Engineering', profilePhoto: 'https://i.pravatar.cc/150?u=alex' },
    { name: 'Sarah Chen', email: 'sarah@demo.airesume', globalRankScore: 885, tier: 'Platinum', categoryTrack: 'Data Science', profilePhoto: 'https://i.pravatar.cc/150?u=sarah' },
    { name: 'Marcus Johnson', email: 'marcus@demo.airesume', globalRankScore: 840, tier: 'Gold', categoryTrack: 'Software Engineering', profilePhoto: 'https://i.pravatar.cc/150?u=marcus' },
    { name: 'Elena Rodriguez', email: 'elena@demo.airesume', globalRankScore: 780, tier: 'Silver', categoryTrack: 'Product Management', profilePhoto: 'https://i.pravatar.cc/150?u=elena' },
    { name: 'David Kim', email: 'david@demo.airesume', globalRankScore: 950, tier: 'Diamond', categoryTrack: 'Design', profilePhoto: 'https://i.pravatar.cc/150?u=david' },
];

(async () => {
    try {
        db.connect();
        await db.migrate();
        for (const u of demoUsers) {
            const existing = await User.findByEmail(u.email);
            const { email, name, ...rest } = u;
            const fields = { ...rest, leaderboardOptIn: true };
            if (existing) await User.update(existing._id, fields);
            else await User.create({ name, email, password: 'password123', ...fields });
        }
        console.log('Leaderboard demo users seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
})();
