const User = require('../models/User');
const File = require('../models/File');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { useCloudinary } = require('../utils/upload');
const { sendOtpEmail, emailConfigured } = require('../utils/emailService');

// Generate JWT
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' });

// Same profile payload the frontend has always received
const profileResponse = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    age: user.age,
    profilePhoto: user.profilePhoto,
    globalRankScore: user.globalRankScore,
    tier: user.tier,
    categoryTrack: user.categoryTrack,
    leaderboardOptIn: user.leaderboardOptIn,
    storedResumes: user.storedResumes,
    token: generateToken(user._id),
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        if (await User.findByEmail(email)) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({ name, email, password });
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } catch (error) {
        if (error.code === '23505') { // unique violation (race on same email)
            return res.status(400).json({ message: 'User already exists' });
        }
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Please provide valid email and password' });
    }

    try {
        const user = await User.findByEmail(email);

        if (user && (await User.matchPassword(user, password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    res.json(req.user);
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const b = req.body;
        const updates = {};
        if (b.name) updates.name = String(b.name).trim();
        if (b.phone !== undefined) updates.phone = String(b.phone ?? '');
        if (b.gender && User.GENDERS.includes(b.gender)) updates.gender = b.gender;
        if (b.age !== undefined) {
            const age = parseInt(b.age, 10);
            updates.age = Number.isFinite(age) && age > 0 && age < 130 ? age : null;
        }
        if (b.profilePhoto !== undefined) updates.profilePhoto = String(b.profilePhoto ?? '');
        if (b.categoryTrack && User.CATEGORIES.includes(b.categoryTrack)) updates.categoryTrack = b.categoryTrack;
        if (b.leaderboardOptIn !== undefined) updates.leaderboardOptIn = Boolean(b.leaderboardOptIn);
        if (b.storedResumes !== undefined) updates.storedResumes = b.storedResumes;

        if (b.password) {
            if (!b.oldPassword) {
                return res.status(400).json({ message: 'Please provide your current password to set a new password' });
            }
            if (!(await User.matchPassword(user, b.oldPassword))) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
            if (String(b.password).length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            }
            updates.password = String(b.password);
        }

        const updatedUser = await User.update(user._id, updates);
        res.json(profileResponse(updatedUser));
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
};

// @desc    Upload resume PDF file to profile
// @route   POST /api/auth/profile/resume
// @access  Private
const uploadProfileResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        let fileUrl = req.file.path; // Cloudinary URL
        if (!useCloudinary) {
            const saved = await File.create(req.user._id, {
                filename: req.file.originalname,
                mimeType: req.file.mimetype,
                buffer: req.file.buffer,
            });
            fileUrl = `${req.protocol}://${req.get('host')}/api/files/${saved.id}`;
        }

        const updatedUser = await User.addStoredResume(req.user._id, {
            title: req.file.originalname.replace(/\.pdf$/i, ''),
            url: fileUrl,
        });
        if (!updatedUser) return res.status(404).json({ message: 'User not found' });

        res.json(profileResponse(updatedUser));
    } catch (error) {
        console.error('Upload Resume Error:', error);
        res.status(500).json({ message: 'Server error uploading resume' });
    }
};

// @desc    Delete a stored resume link by index
// @route   DELETE /api/auth/profile/resume/:index
// @access  Private
const deleteProfileResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const index = parseInt(req.params.index, 10);
        if (!(index >= 0 && index < user.storedResumes.length)) {
            return res.status(400).json({ message: 'Invalid resume index' });
        }

        const remaining = user.storedResumes.filter((_, i) => i !== index);
        const updatedUser = await User.update(user._id, { storedResumes: remaining });
        await File.deleteOwned(File.idFromUrl(user.storedResumes[index].url), user._id);
        res.json(profileResponse(updatedUser));
    } catch (error) {
        console.error('Delete Resume Error:', error);
        res.status(500).json({ message: 'Server error deleting resume' });
    }
};

// @desc    Send password reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // In production, say so clearly instead of pretending an email was sent
    if (process.env.NODE_ENV === 'production' && !emailConfigured()) {
        return res.status(503).json({ message: 'Password reset by email is not available right now. Please contact support.' });
    }

    try {
        const user = await User.findByEmail(email);

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        await User.update(user._id, {
            resetOtp: await bcrypt.hash(otp, await bcrypt.genSalt(10)),
            resetOtpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        const sent = await sendOtpEmail(user.email, otp);
        if (!sent && process.env.NODE_ENV === 'production') {
            return res.status(503).json({ message: 'Could not send the reset email right now. Please try again later.' });
        }

        res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Failed to process request. Please try again later.' });
    }
};

// @desc    Reset password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ message: 'Please provide email, OTP, and new password' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findByEmail(email);

        if (!user || !user.resetOtp || !user.resetOtpExpires) {
            return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
        }

        if (new Date() > new Date(user.resetOtpExpires)) {
            await User.update(user._id, { resetOtp: null, resetOtpExpires: null });
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (!(await bcrypt.compare(String(otp), user.resetOtp))) {
            return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
        }

        await User.update(user._id, { password: newPassword, resetOtp: null, resetOtpExpires: null });

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Failed to reset password. Please try again later.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    uploadProfileResume,
    deleteProfileResume,
    forgotPassword,
    resetPassword,
};
