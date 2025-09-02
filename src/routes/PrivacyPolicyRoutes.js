// Import the Express framework
const express = require('express');

// Create a new router instance
const router = express.Router();

// Import the controller containing logic for handling Privacy Policy data
const privacyPolicyController = require('../controllers/PrivacyPolicyController');

// Import middleware for verifying JWT token (for protected routes)
const { verifyToken } = require('../middleware/VerifyToken');

// ========================
// Privacy Policy Routes
// ========================

// Route: GET /get
// Description: Retrieves all Privacy Policy sections
// Access: Protected (requires a valid token)
router.get('/get', verifyToken, privacyPolicyController.getPrivacyPolicy);

// Route: POST /post
// Description: Inserts a new Privacy Policy section
// Access: Public (can be changed based on use case — consider adding verifyToken if needed)
router.post('/post', privacyPolicyController.createPrivacyPolicySection);

// TODO: Add a route to get a specific section by title
// Example:
// router.get('/get/:title', verifyToken, privacyPolicyController.getSectionByTitle);

// Export the router to be used in the main app
module.exports = router;
