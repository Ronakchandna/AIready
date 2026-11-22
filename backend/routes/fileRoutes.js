const express = require('express');
const router = express.Router();
const File = require('../models/File');

// @route   GET /api/files/:id   (public link, like a Cloudinary URL: the id is an unguessable UUID)
// Used to open/download uploaded resumes and by the AI engine to read them.
router.get('/:id', async (req, res, next) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        const safeName = file.filename.replace(/[^\w.\- ]+/g, '_');
        res.set({
            'Content-Type': file.mime_type,
            'Content-Disposition': `inline; filename="${safeName}"`,
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
        });
        res.send(file.data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
