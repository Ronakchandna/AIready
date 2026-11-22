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
    if (error.code === 'ECONNABORTED') return 'The AI engine took too long to respond. It may be waking up - please try again.';
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return 'The AI engine is unreachable right now.';
    return fallback;
};

// Server-to-server POST to the engine. On the free tier the engine sleeps when idle and Render
// answers 502/503 while it wakes up, so retry those for up to ~75s instead of failing the request.
const axios = require('axios');
const WAKE_STATUSES = new Set([502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const forwardToAi = async (endpoint, data) => {
    const deadline = Date.now() + 75000;
    for (let attempt = 1; ; attempt++) {
        try {
            return await axios.post(`${AI_SERVICE_URL}${endpoint}`, data, {
                headers: { 'x-api-key': AI_API_KEY },
                timeout: 90000, // covers a cold start plus AI generation
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

// Wake the engine when the backend boots so it is usually ready before the first user
const wakeAi = () => axios.get(`${AI_SERVICE_URL}/health`, { timeout: 90000 }).catch(() => {});

module.exports = { AI_SERVICE_URL, AI_API_KEY, aiErrorMessage, forwardToAi, wakeAi };
