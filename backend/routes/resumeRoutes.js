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

// ---------------------------------------------------------------- version history

// @route   GET /api/resume/:id/versions   - saved snapshots, newest first
router.get('/:id/versions', protect, async (req, res, next) => {
    try {
        const resume = await Resume.findOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: 'No resume found' });
        res.json({ success: true, data: await Resume.listVersions(resume._id, req.user._id) });
    } catch (error) { next(error); }
});

// @route   POST /api/resume/:id/versions  { label }  - snapshot the current resume
router.post('/:id/versions', protect, async (req, res, next) => {
    try {
        const resume = await Resume.findOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: 'No resume found' });
        const label = typeof req.body.label === 'string' && req.body.label.trim()
            ? req.body.label : `Version ${new Date().toLocaleDateString('en-IN')}`;
        res.status(201).json({ success: true, data: await Resume.saveVersion(resume, label) });
    } catch (error) { next(error); }
});

// @route   POST /api/resume/:id/versions/:versionId/restore  - make a snapshot the current content
router.post('/:id/versions/:versionId/restore', protect, async (req, res, next) => {
    try {
        const resume = await Resume.findOwned(req.params.id, req.user._id);
        const version = resume && await Resume.findVersion(req.params.versionId, resume._id, req.user._id);
        if (!version) return res.status(404).json({ message: 'Version not found' });
        // keep the current state too, so a restore can be undone
        await Resume.saveVersion(resume, 'Before restore');
        const updated = await Resume.update(resume._id, req.user._id, { content: version.content });
        res.json({ success: true, data: updated });
    } catch (error) { next(error); }
});

// @route   DELETE /api/resume/:id/versions/:versionId
router.delete('/:id/versions/:versionId', protect, async (req, res, next) => {
    try {
        const ok = await Resume.deleteVersion(req.params.versionId, req.params.id, req.user._id);
        if (!ok) return res.status(404).json({ message: 'Version not found' });
        res.json({ success: true });
    } catch (error) { next(error); }
});

module.exports = router;
