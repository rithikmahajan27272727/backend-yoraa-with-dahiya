// Import required dependencies
const express = require("express"); // Express framework for routing
const {
  getOrdersByUser,
  cancelOrder,
  getExchangeOrdersByUser,
  createReturnOrder,
  getReturnOrdersByUser,
  createExchangeOrder,
  getDeliveredOrdersByUser,
  getAllOrdersSorted,
  authenticateShiprocket,
  getShiprocketTracking,
  getOrderStatusCounts,
} = require("../controllers/paymentController/OrderController"); // Controller for order-related logic
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens
const multer = require("multer"); // Middleware for handling file uploads

// Initialize an Express router instance
const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory (not on disk) for direct upload to S3
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit each file to 10MB
}).array("images", 3); // Handle up to 3 files in the 'images' field

// Define order-related API endpoints
router
  // GET /api/orders/getAllByUser
  // Retrieves all orders for the authenticated user
  .get("/getAllByUser", verifyToken, getOrdersByUser)

  // POST /api/orders/cancel/:order_id
  // Cancels a specific order by its ID (no file upload required)
  .post("/cancel/:order_id", cancelOrder)

  // GET /api/orders/getAllOrder
  // Retrieves all orders, sorted (likely for admin use, authenticated)
  .get("/getAllOrder", verifyToken, getAllOrdersSorted)

  // POST /api/orders/shiprocket/auth
  // Authenticates with Shiprocket API (no file upload required)
  .post("/shiprocket/auth", authenticateShiprocket)

  // GET /api/orders/shiprocket/track/:awbCode
  // Retrieves tracking information from Shiprocket by AWB code (no file upload)
  .get("/shiprocket/track/:awbCode", getShiprocketTracking)

  // GET /api/orders/delivered
  // Retrieves delivered orders for the authenticated user
  .get("/delivered", verifyToken, getDeliveredOrdersByUser)

  // GET /api/orders/exchange-orders
  // Retrieves exchange orders for the authenticated user
  .get("/exchange-orders", verifyToken, getExchangeOrdersByUser)

  // GET /api/orders/return-orders
  // Retrieves return orders for the authenticated user
  .get("/return-orders", verifyToken, getReturnOrdersByUser)

  // GET /api/orders/status-counts
  // Retrieves counts of orders by status (e.g., pending, delivered) for the authenticated user
  .get("/status-counts", verifyToken, getOrderStatusCounts)

  // POST /api/orders/exchange
  // Creates an exchange order with optional image uploads (up to 3 images)
  .post("/exchange", verifyToken, upload, createExchangeOrder)

  // POST /api/orders/return
  // Creates a return order with optional image uploads (up to 3 images)
  .post("/return", verifyToken, upload, createReturnOrder);

// Export the router for use in the main Express app
module.exports = router;