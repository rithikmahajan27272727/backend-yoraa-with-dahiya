// Import required modules
const express = require("express");

// Import controller that handles wishlist-related logic
const wishlistController = require("../controllers/wishlistController/WishlistController");

// Import middleware to verify JWT token (for authentication)
const { verifyToken } = require("../middleware/VerifyToken");

// Initialize a new Express router
const wishlistRouter = express.Router();

/**
 * @route   POST /add
 * @desc    Add an item to the user's wishlist
 * @access  Protected (User must be authenticated)
 */
wishlistRouter.post("/add", verifyToken, wishlistController.addToWishlist);

/**
 * @route   GET /
 * @desc    Retrieve the authenticated user's wishlist
 * @access  Protected
 */
wishlistRouter.get("/", verifyToken, wishlistController.getWishlist);

/**
 * @route   DELETE /remove/:itemId
 * @desc    Remove a specific item from the wishlist by item ID
 * @access  Protected
 */
wishlistRouter.delete("/remove/:itemId", verifyToken, wishlistController.removeFromWishlist);

/**
 * @route   DELETE /clear
 * @desc    Clear the entire wishlist for the authenticated user
 * @access  Protected
 */
wishlistRouter.delete("/clear", verifyToken, wishlistController.clearWishlist);

// Export the router to be used in the main application
module.exports = wishlistRouter;
