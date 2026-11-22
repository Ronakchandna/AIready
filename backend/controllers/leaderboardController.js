const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @desc    Get top ranked users (only those who opted in and have a score)
// @route   GET /api/leaderboard
// @access  Public
const getLeaderboard = asyncHandler(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const leaderboard = await User.leaderboard(category);

    res.json({
        success: true,
        count: leaderboard.length,
        data: leaderboard
    });
});

module.exports = { getLeaderboard };
