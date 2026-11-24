// Single source of truth for the Python AI engine connection.
// Older variable names are still accepted so existing .env files keep working.
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || process.env.AI_ENGINE_URL || process.env.PYTHON_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const AI_API_KEY = process.env.AI_API_KEY || process.env.API_KEY || '';

if (!AI_API_KEY) {
    console.warn('WARNING: AI_API_KEY is not set - calls to the AI engine will be rejected (401).');
}

// Turn an AI-engine error into a readable message (engine returns { error, detail }).
const aiErrorMessage = (error, fallback = 'AI Engine service error') => {
    const data = error.response?.data;
    if (data) {
        if (typeof data.error === 'string') return data.error;
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail) && data.detail[0]?.message) return data.detail[0].message;
    }
    if (WAKE_STATUSES.has(error.response?.status) || error.code === 'ECONNRESET') {
        return 'The AI engine is still starting up (free server). Please try again in a minute.';
    }
    if (error.code === 'ECONNABORTED') return 'The AI engine took too long to respond. It may be waking up - please try again.';
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return 'The AI engine is unreachable right now.';
    return fallback;
};

// Server-to-server POST to the engine. On the free tier the engine sleeps when idle and Render
// answers 502/503 while it wakes up (a cold start can take several minutes), so retry those for
// up to AI_WAKE_TIMEOUT_MS instead of failing the request. The frontend also waits on /api/ai/status.
const axios = require('axios');
const WAKE_STATUSES = new Set([502, 503, 504]);
const WAKE_TIMEOUT_MS = Number(process.env.AI_WAKE_TIMEOUT_MS) || 150000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const forwardToAi = async (endpoint, data) => {
    const deadline = Date.now() + WAKE_TIMEOUT_MS;
    for (let attempt = 1; ; attempt++) {
        try {
            return await axios.post(`${AI_SERVICE_URL}${endpoint}`, data, {
                headers: { 'x-api-key': AI_API_KEY },
                timeout: 90000, // one attempt: covers AI generation on a slow free instance
                maxBodyLength: 10 * 1024 * 1024,
            });
        } catch (error) {
            const status = error.response?.status;
            const waking = WAKE_STATUSES.has(status) || error.code === 'ECONNRESET';
            if (!waking || Date.now() + 5000 > deadline) throw error;
            console.warn(`AI engine not ready (${status || error.code}), retry ${attempt}...`);
            await sleep(Math.min(5000 * attempt, 15000));
        }
    }
};

// Wake the engine (fire and forget). Called at boot, at login and by /api/ai/status.
let wakeInFlight = null;
const wakeAi = () => {
    if (!wakeInFlight) {
        wakeInFlight = axios.get(`${AI_SERVICE_URL}/health`, { timeout: 120000 })
            .catch(() => {})
            .finally(() => { wakeInFlight = null; });
    }
    return wakeInFlight;
};

// Quick readiness check: true when the engine answers /health within a few seconds.
const aiReady = async () => {
    try {
        const { data } = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 6000 });
        return data?.status === 'ok';
    } catch {
        wakeAi(); // keep the wake-up going in the background
        return false;
    }
};

module.exports = { AI_SERVICE_URL, AI_API_KEY, aiErrorMessage, forwardToAi, wakeAi, aiReady };
