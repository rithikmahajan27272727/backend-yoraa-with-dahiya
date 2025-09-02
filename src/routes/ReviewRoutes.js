const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// ---------- USER ROUTES (Item._id) ----------

// Create a review (user)
router.post('/user/:itemId/reviews', isAuthenticated, reviewController.createReview);

// Get reviews for Item (user)
router.get('/user/:itemId/reviews', reviewController.getReviews);

// Update user's own review (user)
router.put('/user/:itemId/reviews/:reviewId', isAuthenticated, reviewController.updateReview);

// Delete user's own review (user)
router.delete('/user/:itemId/reviews/:reviewId', isAuthenticated, reviewController.deleteReview);

// Get average rating for Item (user)
router.get('/user/:itemId/average-rating', reviewController.getAverageRating);

// ---------- PUBLIC ROUTES (Item._id) ----------

// Get reviews by Item ID (public)
router.get('/public/:itemId/reviews', reviewController.getReviews);

// Get average rating by Item ID (public)
router.get('/public/:itemId/average-rating', reviewController.getAverageRating);

// ---------- ADMIN ROUTES (Item._id and ItemDetails._id) ----------

// Get reviews by Item ID (admin)
router.get('/admin/:itemId/reviews', isAuthenticated, isAdmin, reviewController.getReviews);

// Add a fake review using userId (admin, uses itemDetailsId)
router.post('/admin/:itemDetailsId/reviews', isAuthenticated, isAdmin, reviewController.createFakeReview);

// Update review settings (admin, uses itemDetailsId)
router.put('/admin/:itemDetailsId/review-settings', isAuthenticated, isAdmin, reviewController.updateReviewSettings);

module.exports = router;