// Creates/refreshes the demo leaderboard users and the demo account.  Run: npm run seed
// (The server also creates the leaderboard users automatically on start unless DEMO_MODE=false.)
require('dotenv').config();
const db = require('./db');
const demo = require('./demo');

(async () => {
    try {
        db.connect();
        await db.migrate();
        await demo.ensureDemoData();
        await demo.resetDemoAccount();
        console.log('Demo data seeded.');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
})();
