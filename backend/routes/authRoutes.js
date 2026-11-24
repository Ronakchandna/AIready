const express = require('express');
const router = express.Router();
const { registerUser, loginUser, demoLogin, getUserProfile, updateUserProfile, deleteAccount, uploadProfileResume, deleteProfileResume, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../utils/upload');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/demo', demoLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile)
    .delete(protect, deleteAccount); // permanently delete the account (password required)

router.post('/profile/resume', protect, upload.single('resume'), uploadProfileResume);
router.delete('/profile/resume/:index', protect, deleteProfileResume);

module.exports = router;
