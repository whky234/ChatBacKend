const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authenticateJWT = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'Access denied, no token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("Decoded token:", decoded); // Log decoded token

        // Find user by ID in token
        const user = await User.findById(decoded.id).select('-password');
        // console.log("Authenticated user:", user); // Log user info

        if (!user) {
            console.log("User not found in database");
            return res.status(404).json({ message: 'User not found.' });
        }

        // console.log("Token received:", token);
// console.log("Decoded token:", decoded);
// console.log("Authenticated user:", user);
// console.log("Updating user status to online...");
        // Update `isOnline` status
        user.isOnline = true;
        await user.save();

        // Attach user to request object
        req.user = user;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            console.log("Token expired. Marking user as offline.");

            const decoded = jwt.decode(token);
            if (decoded?.id) {
                // Update user to offline if the token has expired
                await User.findByIdAndUpdate(decoded.id, { isOnline: false });
            }

            return res.status(403).json({ message: 'Token expired. Please login again.' });
        }

        console.log("Token verification failed:", error.message);
        res.status(403).json({ message: 'Invalid token.' });
    }
};




module.exports = authenticateJWT;
