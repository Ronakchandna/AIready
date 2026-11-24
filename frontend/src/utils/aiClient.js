// Calls to AI features through the backend, tolerant of the free-tier AI engine sleeping.
// When the engine is asleep, Render answers 502/503/504 (or the request fails without CORS headers),
// so we poll /api/ai/status until it is up and send the request again.
import axios from 'axios';

export const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
export const MAX_PDF_MB = 5;

const WAKING = new Set([502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const WAKING_MESSAGE = 'The AI engine is waking up (free server, it sleeps when nobody uses it). This usually takes 1-3 minutes, sometimes up to 10 - keep this page open and it will continue automatically.';

// Readable message from any failed request
export const aiErrorText = (err, fallback = 'Something went wrong. Please try again.') => {
    const data = err?.response?.data;
    if (data && typeof data === 'object') {
        if (typeof data.message === 'string' && data.message) return data.message;
        if (typeof data.detail === 'string' && data.detail) return data.detail;
    }
    if (!err?.response) return 'Cannot reach the server. Check your internet connection and try again.';
    return fallback;
};

// Validate a resume PDF on the client before uploading. Returns an error message or ''.
export const checkPdf = (file) => {
    if (!file) return 'Please choose a PDF file.';
    const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '') || !file.type;
    if (!looksPdf) return 'Only PDF files are supported. Save or export your resume as PDF and try again.';
    if (file.size === 0) return 'That file is empty.';
    if (file.size > MAX_PDF_MB * 1024 * 1024) return `File is too large (${(file.size / 1048576).toFixed(1)} MB). Maximum is ${MAX_PDF_MB} MB.`;
    return '';
};

// Ask the backend whether the engine is awake (this also starts waking it)
export const warmUpAi = () => axios.get(`${NODE_API}/ai/status`, { headers: authHeaders(), timeout: 15000 })
    .then((r) => !!r.data?.ready).catch(() => false);

export const waitForAi = async (maxMs = 15 * 60 * 1000) => {
    const end = Date.now() + maxMs;
    while (Date.now() < end) {
        if (await warmUpAi()) return true;
        await sleep(5000);
    }
    return false;
};

// POST to an AI route; onStatus('waking') is called while waiting for the engine to start.
export const postAi = async (path, body, { onStatus } = {}) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await axios.post(`${NODE_API}${path}`, body, { headers: authHeaders() });
        } catch (err) {
            const waking = !err.response || WAKING.has(err.response.status);
            if (!waking || attempt >= 2) throw err;
            onStatus?.('waking');
            const up = await waitForAi();
            onStatus?.('working');
            if (!up) throw err;
        }
    }
};
