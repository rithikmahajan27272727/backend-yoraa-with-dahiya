// Import required dependencies
const express = require("express"); // Express framework for routing
const router = express.Router(); // Initialize an Express router instance
const itemDetailsController = require("../controllers/itemController/ItemDetailsController"); // Controller for item details logic
const multer = require("multer"); // Middleware for handling file uploads
const checkAdminRole = require("../middleware/CheckAdminRole"); // Middleware to restrict access to admins
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens

// Configure multer for in-memory storage and file upload limits
const storage = multer.memoryStorage(); // Store files in memory (not on disk) for direct upload to S3
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit each file to 10MB
}).fields([
  // Define multiple file fields with maximum counts
  { name: "images", maxCount: 25 }, // Up to 25 image files
  { name: "videos", maxCount: 25 }, // Up to 25 video files
  { name: "sizeChartInch", maxCount: 1 }, // Single size chart in inches
  { name: "sizeChartCm", maxCount: 1 }, // Single size chart in centimeters
  { name: "sizeMeasurement", maxCount: 1 }, // Single size measurement file
]);

// Define item details-related API endpoints
router
  // GET /api/itemDetails/zero-stock
  // Retrieves item details for items with zero stock
  .get("/download",verifyToken,checkAdminRole, itemDetailsController.downloadAllItemDetails)

  .get("/zero-stock", itemDetailsController.getZeroStockItemDetails)

  // GET /api/itemDetails/out-of-stock/count
  // Retrieves the count of out-of-stock items
  .get("/out-of-stock/count", itemDetailsController.getOutOfStockCount)

  // POST /api/itemDetails/:itemId
  // Creates item details for a specific item (e.g., images, videos, size charts)
  .post("/:itemId", upload, itemDetailsController.createItemDetails)

  // GET /api/itemDetails/
  // Retrieves all item details
  .get("/", itemDetailsController.getAllItemDetails)

  // GET /api/itemDetails/:itemId
  // Retrieves item details for a specific item by its ID
  .get("/:itemId", itemDetailsController.getItemDetailsByItemId)

  // PUT /api/itemDetails/update/:itemId
  // Updates item details for a specific item (e.g., update images, videos, size charts)
  .put("/update/:itemId", upload, itemDetailsController.updateItemDetails)

  // DELETE /api/itemDetails/:id
  // Deletes item details by their ID
  .delete("/:id", itemDetailsController.deleteItemDetails)

  // POST /api/itemDetails/delete-media/:itemId
  // Deletes specific media (e.g., images, videos) from item details
  .post("/delete-media/:itemId", itemDetailsController.deleteMediaFromItemDetails);

// Export the router for use in the main Express app
module.exports = router;