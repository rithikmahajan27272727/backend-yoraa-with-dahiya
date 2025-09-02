// Import required modules
const express = require("express");

// Import user controller containing business logic for user operations
const userController = require("../controllers/userController/UserController");

// Import middleware to verify JWT token
const { verifyToken } = require("../middleware/VerifyToken");

// Create a new router instance
const router = express.Router();

/**
 * @route   GET /getUser
 * @desc    Get the authenticated user's details by token
 * @access  Protected
 */
router.get("/getUser", verifyToken, userController.getById);

/**
 * @route   PATCH /:id
 * @desc    Update user data by user ID
 * @access  Public (⚠️ Consider adding verifyToken if this should be protected)
 */
router.patch("/:id", userController.updateById);

/**
 * @route   GET /getAlluser
 * @desc    Get a list of all users
 * @access  Protected
 */
router.get("/getAlluser", verifyToken, userController.getAllUsers);

// Export the router to be used in the main app
module.exports = router;
