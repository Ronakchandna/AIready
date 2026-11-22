const JobApplication = require('../models/JobApplication');

const ALLOWED_FIELDS = ['company', 'role', 'status', 'url', 'location', 'notes'];

exports.createApplication = async (req, res) => {
    try {
        const { company, role, status } = req.body;
        if (!company || !role || typeof company !== 'string' || typeof role !== 'string') {
            return res.status(400).json({ success: false, message: 'Company and role are required' });
        }
        if (status && !JobApplication.STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const savedApp = await JobApplication.create(req.user._id, req.body);
        res.status(201).json({ success: true, data: savedApp });
    } catch (error) {
        console.error('Create application error', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getApplications = async (req, res) => {
    try {
        const apps = await JobApplication.findAllByUser(req.user._id);
        res.json({ success: true, data: apps });
    } catch (error) {
        console.error('Get applications error', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateApplication = async (req, res) => {
    try {
        const app = await JobApplication.findById(req.params.id);
        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        if (app.user !== req.user._id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        // Whitelist allowed fields to prevent mass assignment
        const updateData = {};
        for (const field of ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        }
        if (updateData.status && !JobApplication.STATUSES.includes(updateData.status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const updated = await JobApplication.update(req.params.id, updateData);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update application error', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteApplication = async (req, res) => {
    try {
        const app = await JobApplication.findById(req.params.id);
        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        if (app.user !== req.user._id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await JobApplication.delete(req.params.id);
        res.json({ success: true, message: 'Application removed' });
    } catch (error) {
        console.error('Delete application error', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
