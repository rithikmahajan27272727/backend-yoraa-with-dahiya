const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

// Middleware to check if the user has admin role
const checkAdminRole = async (req, res, next) => {
    // Extract token from Authorization header
    const token = req.header('Authorization').replace('Bearer ', '');
    console.log("token", token);

    // If token is missing, deny access
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Verify the token using secret key
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log("decoded", decoded);

        // Find user by ID from decoded token
        const user = await User.findById(decoded._id);

        // If user is not found
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is an admin
        if (!user.isAdmin) {
            return res.status(403).json({ message: 'Access denied, admin rights required' });
        }

        // Attach user to request and continue
        req.user = user;
        next();
    } catch (error) {
        // If token verification fails
        return res.status(401).json({ message: 'Unauthorized, invalid token' });
    }
};

module.exports = checkAdminRole;
