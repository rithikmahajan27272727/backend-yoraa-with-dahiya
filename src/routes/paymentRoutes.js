// Import the Express framework
const express = require("express");

// Create a new router object using Express
const router = express.Router();

// Import the payment controller containing business logic for handling payments
const paymentController = require("../controllers/paymentController/paymentController");

// Import middleware to verify JWT token for protected routes
const { verifyToken } = require("../middleware/VerifyToken");

// Route to create a payment order
// Protected by verifyToken middleware to ensure only authenticated users can access it
router.post("/create-order", verifyToken, paymentController.createOrder);

// Route to verify payment after the transaction is completed
// No token verification here — ensure this endpoint is secured appropriately (e.g., webhook verification)
router.post("/verify-payment", paymentController.verifyPayment);

// Export the router to be used in the main app file (e.g., app.js)
module.exports = router;
