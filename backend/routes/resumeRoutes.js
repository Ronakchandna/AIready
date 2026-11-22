const express = require('express');
const router = express.Router();
const Resume = require('../models/Resume');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/resume
// @desc    Create or update a user's resume
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { id, title, content } = req.body;
        if (content !== undefined && (typeof content !== 'object' || Array.isArray(content))) {
            return res.status(400).json({ message: 'Invalid resume content' });
        }

        if (id) {
            const resume = await Resume.update(id, req.user._id, { title, content });
            if (!resume) {
                return res.status(404).json({ message: 'Resume not found or unauthorized' });
            }
            return res.status(200).json({ success: true, data: resume });
        }

        const resume = await Resume.create(req.user._id, { title, content });
        res.status(200).json({ success: true, data: resume });
    } catch (error) {
        console.error('Save Resume Error:', error.message);
        res.status(500).json({ message: 'Server Error saving resume' });
    }
});

// @route   GET /api/resume
// @desc    Get user's latest resume
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const resume = await Resume.findLatest(req.user._id);
        res.status(200).json({ success: true, data: resume || null });
    } catch (error) {
        console.error('Fetch Resume Error:', error.message);
        res.status(500).json({ message: 'Server Error fetching resume' });
    }
});

// @route   GET /api/resume/all
// @desc    Get all user resumes
// @access  Private
router.get('/all', protect, async (req, res) => {
    try {
        const resumes = await Resume.findAllByUser(req.user._id);
        res.status(200).json({ success: true, data: resumes });
    } catch (error) {
        console.error('Fetch All Resumes Error:', error.message);
        res.status(500).json({ message: 'Server Error fetching resumes' });
    }
});

// @route   DELETE /api/resume/:id
// @desc    Delete a resume
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const deleted = await Resume.deleteOwned(req.params.id, req.user._id);
        if (!deleted) {
            return res.status(404).json({ message: 'No resume found' });
        }
        res.status(200).json({ success: true, message: 'Resume deleted' });
    } catch (error) {
        console.error('Delete Resume Error:', error.message);
        res.status(500).json({ message: 'Server Error deleting resume' });
    }
});

module.exports = router;
