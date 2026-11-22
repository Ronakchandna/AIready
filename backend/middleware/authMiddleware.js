const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    let decoded;
    try {
        decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }

    try {
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        // eslint-disable-next-line no-unused-vars
        const { password, resetOtp, resetOtpExpires, ...safeUser } = user; // never expose secrets
        req.user = safeUser;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { protect };
