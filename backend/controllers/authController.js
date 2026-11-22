const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { useCloudinary } = require('../utils/upload');
const { sendOtpEmail } = require('../utils/emailService');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    // Input Validation
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
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
        res.status(500).json({ message: 'Server error', error: error.message });
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

        if (user) {
            user.name = req.body.name || user.name;
            user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;
            user.gender = req.body.gender || user.gender;
            user.age = req.body.age !== undefined ? req.body.age : user.age;
            user.profilePhoto = req.body.profilePhoto !== undefined ? req.body.profilePhoto : user.profilePhoto;
            user.categoryTrack = req.body.categoryTrack || user.categoryTrack;
            user.leaderboardOptIn = req.body.leaderboardOptIn !== undefined ? req.body.leaderboardOptIn : user.leaderboardOptIn;

            if (req.body.storedResumes !== undefined) {
                user.storedResumes = req.body.storedResumes;
            }

            if (req.body.password) {
                if (!req.body.oldPassword) {
                    return res.status(400).json({ message: 'Please provide your current password to set a new password' });
                }
                if (!(await user.matchPassword(req.body.oldPassword))) {
                    return res.status(401).json({ message: 'Current password is incorrect' });
                }
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                gender: updatedUser.gender,
                age: updatedUser.age,
                profilePhoto: updatedUser.profilePhoto,
                globalRankScore: updatedUser.globalRankScore,
                tier: updatedUser.tier,
                categoryTrack: updatedUser.categoryTrack,
                leaderboardOptIn: updatedUser.leaderboardOptIn,
                storedResumes: updatedUser.storedResumes,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
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
        const user = await User.findById(req.user._id);

        if (user) {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            let fileUrl = req.file.path;
            if (!useCloudinary) {
                // If local fallback, construct the full URL
                fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }

            // Append new resume
            user.storedResumes.push({
                title: req.file.originalname.replace('.pdf', ''),
                url: fileUrl
            });

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                gender: updatedUser.gender,
                age: updatedUser.age,
                profilePhoto: updatedUser.profilePhoto,
                globalRankScore: updatedUser.globalRankScore,
                tier: updatedUser.tier,
                categoryTrack: updatedUser.categoryTrack,
                leaderboardOptIn: updatedUser.leaderboardOptIn,
                storedResumes: updatedUser.storedResumes,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
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

        if (user) {
            const index = parseInt(req.params.index);
            if (index >= 0 && index < user.storedResumes.length) {
                user.storedResumes.splice(index, 1);
                const updatedUser = await user.save();

                res.json({
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    gender: updatedUser.gender,
                    age: updatedUser.age,
                    profilePhoto: updatedUser.profilePhoto,
                    globalRankScore: updatedUser.globalRankScore,
                    tier: updatedUser.tier,
                    categoryTrack: updatedUser.categoryTrack,
                    leaderboardOptIn: updatedUser.leaderboardOptIn,
                    storedResumes: updatedUser.storedResumes,
                    token: generateToken(updatedUser._id),
                });
            } else {
                res.status(400).json({ message: 'Invalid resume index' });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
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

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // Hash the OTP before storing
        const salt = await bcrypt.genSalt(10);
        user.resetOtp = await bcrypt.hash(otp, salt);
        user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        // Send OTP email
        await sendOtpEmail(user.email, otp);

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

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: 'Please provide email, OTP, and new password' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user || !user.resetOtp || !user.resetOtpExpires) {
            return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
        }

        // Check if OTP has expired
        if (new Date() > user.resetOtpExpires) {
            user.resetOtp = null;
            user.resetOtpExpires = null;
            await user.save();
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        // Verify OTP
        const isOtpValid = await bcrypt.compare(otp, user.resetOtp);
        if (!isOtpValid) {
            return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
        }

        // Reset password (pre-save hook will hash it)
        user.password = newPassword;
        user.resetOtp = null;
        user.resetOtpExpires = null;
        await user.save();

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
