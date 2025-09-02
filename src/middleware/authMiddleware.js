const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.isAuthenticated = async (req, res, next) => {
  try {
        // Extract the token from Authorization header
        const authHeader = req.headers.authorization;

        // If no token is present or it doesn't start with 'Bearer', return 401
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Token missing, please login again" });
        }

        const token = authHeader.split(" ")[1]; // Extract token after 'Bearer'
        // console.log("Extracted token:", token);

        // Verify the token using the secret key
        const decodedInfo = jwt.verify(token, process.env.SECRET_KEY);
        // console.log("Decoded token info:", decodedInfo);
        console.log("Decoded inside verify token services token payload:", decodedInfo);

        // Check if decoded token contains user ID
        if (decodedInfo && decodedInfo._id) {
            req.user = decodedInfo; // Attach decoded user data to request
            return next(); // Proceed to next middleware or route
        }

        // If token is invalid (missing `_id`)
        return res.status(401).json({ message: "Invalid Token, please login again" });

    } catch (error) {
        console.log("JWT Verification Error:", error);

        // Handle specific JWT errors
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: "Token expired, please login again" });
        } else if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: "Invalid Token, please login again" });
        } else {
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }
};

exports.isAdmin = async (req, res, next) => {
  console.log('Checking isAdmin for user:', req.user ? { id: req.user._id, isAdmin: req.user.isAdmin } : 'No user');
  if (req.user && req.user.isAdmin) {
    console.log('Admin access granted');
    next();
  } else {
    console.log('Admin access denied');
    res.status(403).json({ message: 'Admin access required' });
  }
};