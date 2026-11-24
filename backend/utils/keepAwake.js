// Keeps the free Render backend and AI engine awake during the daytime (India time).
// GitHub's scheduled workflows are throttled heavily on small repos (keep-awake.yml ran only a few
// times a day), so the backend does it itself: every 10 minutes it calls its own public URL (which
// counts as traffic for Render) and the AI engine's /health.
//
// Window: 09:30-21:30 IST by default (KEEP_AWAKE_START / KEEP_AWAKE_END, hours in IST, decimals ok).
// Render's free plan has 750 instance hours/month: 2 services x 12 h x 31 days = 744 h, so do not
// widen the window. Outside it the services sleep normally; the first visitor wakes them again.
// Disable with KEEP_AWAKE=false. Only active on Render (RENDER_EXTERNAL_URL is set there).
const { wakeAi } = require('../config/ai');

const INTERVAL_MS = 10 * 60 * 1000;
const START = Number(process.env.KEEP_AWAKE_START ?? 9.5);
const END = Number(process.env.KEEP_AWAKE_END ?? 21.5);

const istHour = (date = new Date()) => ((date.getUTCHours() + date.getUTCMinutes() / 60 + 5.5) % 24);
const inWindow = (date) => {
    const h = istHour(date);
    return START <= END ? h >= START && h < END : h >= START || h < END;
};

const start = () => {
    const selfUrl = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
    if (process.env.KEEP_AWAKE === 'false' || !selfUrl) return null;
    const tick = () => {
        if (!inWindow()) return;
        fetch(`${selfUrl}/api/health`, { signal: AbortSignal.timeout(60000) }).catch(() => {});
        wakeAi();
    };
    console.log(`Keep-awake: pinging backend and AI engine every 10 min between ${START}h and ${END}h IST`);
    return setInterval(tick, INTERVAL_MS);
};

module.exports = { start, inWindow, istHour };
