// Import the Razorpay Node.js SDK
const Razorpay = require("razorpay");

// Load environment variables from .env file (ensure dotenv is configured in your main app)
require("dotenv").config();

// Initialize Razorpay instance with API credentials from environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Razorpay Key ID from .env (e.g., rzp_live_XXXXXXXXXXXXXX)
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Razorpay Key Secret from .env
});

// Export the Razorpay instance for use in other modules
module.exports = razorpay;