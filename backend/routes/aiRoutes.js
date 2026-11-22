const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { aiErrorMessage, forwardToAi } = require('../config/ai');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // matches the AI engine's 5MB PDF limit
});


// Uniform error response for every AI route
const sendAiError = (res, label, error) => {
    console.error(`${label}:`, error.response?.data || error.message);
    const status = error.response?.status || (error.code === 'ECONNABORTED' ? 504 : 502);
    const message = aiErrorMessage(error);
    res.status(status).json({ success: false, message, detail: message });
};

const pdfForm = (file, field) => {
    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype || 'application/pdf' });
    formData.append(field, blob, file.originalname || 'resume.pdf');
    return formData;
};

// Simple JSON pass-through routes: [path, engine endpoint, log label]
const jsonRoutes = [
    ['/enhance-bullet', '/enhance_bullet', 'AI Enhance Bullet Error'],
    ['/generate-questions', '/generate_questions', 'AI Generate Questions Error'],
    ['/evaluate-answer', '/evaluate_answer', 'AI Evaluate Answer Error'],
    ['/generate-cover-letter', '/generate_cover_letter', 'AI Cover Letter Error'],
    ['/extract-keywords', '/extract_keywords', 'AI Extract Keywords Error'],
    ['/evaluate-global-rank', '/evaluate_global_rank', 'AI Evaluate Global Rank Error'],
];

for (const [path, endpoint, label] of jsonRoutes) {
    router.post(path, protect, async (req, res) => {
        try {
            const response = await forwardToAi(endpoint, req.body);
            res.status(response.status).json(response.data);
        } catch (error) {
            sendAiError(res, label, error);
        }
    });
}

// @route   POST /api/ai/analyze-resume  (PDF upload or raw text)
router.post('/analyze-resume', protect, upload.single('resume_file'), async (req, res) => {
    try {
        const formData = req.file ? pdfForm(req.file, 'resume_file') : new FormData();
        formData.append('job_description', req.body.job_description || '');
        if (!req.file) formData.append('resume_text', req.body.resume_text || '');
        formData.append('use_ai', 'true'); // include AI recommendations when the engine has an LLM

        const response = await forwardToAi('/analyze_resume', formData);
        res.status(response.status).json(response.data);
    } catch (error) {
        sendAiError(res, 'AI Analyze Resume Error', error);
    }
});

// @route   POST /api/ai/parse-linkedin  and  /api/ai/parse-resume  (PDF upload)
for (const [path, endpoint, label] of [
    ['/parse-linkedin', '/parse_linkedin', 'AI Parse LinkedIn Error'],
    ['/parse-resume', '/parse_resume', 'AI Parse Resume Error'],
]) {
    router.post(path, protect, upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'PDF file is required' });
        }
        try {
            const response = await forwardToAi(endpoint, pdfForm(req.file, 'file'));
            res.status(response.status).json(response.data);
        } catch (error) {
            sendAiError(res, label, error);
        }
    });
}

module.exports = router;
