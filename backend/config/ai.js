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

module.exports = { AI_SERVICE_URL, AI_API_KEY, aiErrorMessage };
