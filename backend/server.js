require('dotenv').config();

// Fail fast with a clear message instead of crashing later
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`FATAL: missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const db = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const start = async () => {
    db.connect();
    try {
        await db.migrate(); // creates tables on first run, no-op afterwards
        console.log('PostgreSQL connected, schema ready');
    } catch (err) {
        console.error('FATAL: could not prepare the database:', err.message);
        process.exit(1);
    }
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
    require('./demo').ensureDemoData(); // sample leaderboard users (DEMO_MODE=false to disable)
    require('./config/ai').wakeAi(); // start waking the (free-tier) AI engine early
};

start();
