// Import required dependencies
const express = require("express"); // Express framework for routing
const multer = require("multer"); // Middleware for handling file uploads
const itemController = require("../controllers/itemController/ItemController"); // Controller for item-related logic
const { uploadMultipart, deleteFileFromS3 } = require("../utils/S3"); // S3 utilities for file upload and deletion
const mongoose = require("mongoose"); // Mongoose for MongoDB operations
const { ApiResponse } = require("../utils/ApiResponse"); // Utility to standardize API responses
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens
const Item = require("../models/Item"); // Mongoose model for Item collection
const SubCategory = require("../models/SubCategory"); // Mongoose model for SubCategory collection
const checkAdminRole = require("../middleware/CheckAdminRole"); // Middleware to restrict access to admins

// Initialize an Express router instance
const itemRouter = express.Router();

// Configure multer for in-memory storage (files are stored in memory, not on disk)
const storage = multer.memoryStorage();
const upload = multer({ storage }); // Multer instance for handling single file uploads

// POST /api/items/
// Creates a new item with an image upload (admin-only)
itemRouter.get(
  "/download",
  verifyToken,
  checkAdminRole,
  async (req, res) => {
    try {
      const items = await Item.find()
        .populate("subCategoryId", "name")
        .populate("categoryId", "name")
        .lean();
      res.setHeader("Content-Disposition", 'attachment; filename="items.json"');
      res.setHeader("Content-Type", "application/json");
      // Pretty-print JSON with 2-space indentation
      res.status(200).send(JSON.stringify(items, null, 2));
    } catch (error) {
      console.error("Error downloading items:", error);
      res
        .status(500)
        .json(
          ApiResponse(null, "Error downloading items", false, 500, error.message)
        );
    }
  }
);
itemRouter.post(
  "/",
  verifyToken, // Ensure user is authenticated
  checkAdminRole, // Ensure user has admin role
  upload.single("image"), // Handle single file upload (field name: "image")
  async (req, res) => {
    console.log("qqqqqqqqqqqqqq"); // Debug log
    try {
      // Check if an image file was uploaded
      if (!req.file) {
        return res
          .status(400)
          .json(ApiResponse(null, "No file uploaded", false, 400));
      }

      console.log("qqqqqqqqqqqqqq11111111111", req.body); // Log request body for debugging

      // Verify the provided subCategoryId exists
      const existingSubCategory = await SubCategory.findOne({
        _id: req.body.subCategoryId,
      });
      if (!existingSubCategory) {
        return res
          .status(404)
          .json(ApiResponse(null, "SubCategory not found", false, 404));
      }
      const categoryId = existingSubCategory.categoryId; // Get associated category ID
      console.log("qqq2222", categoryId); // Log category ID for debugging

      // Check for duplicate item name
      const existingItems = await Item.findOne({ name: req.body.name });
      if (existingItems) {
        return res
          .status(400)
          .json(ApiResponse(null, "Items name already exists", false, 400));
      }

      // Generate a new MongoDB ObjectId for the item
      const newItemId = new mongoose.Types.ObjectId();

      // Upload the image to AWS S3 with a path like categories/{categoryId}/{subCategoryId}/{itemId}
      const fileUrl = await uploadMultipart(
        req.file,
        `categories/${categoryId}/${existingSubCategory._id}`,
        newItemId || "default"
      );
      console.log("File uploaded to:", fileUrl); // Log S3 URL for debugging

      // Attach the image URL to the request body for use in the controller
      req.body.imageUrl = fileUrl;

      // Call the controller to create the item
      const item = await itemController.createItem(req, res, newItemId);

      // Prevent further execution if the controller already sent a response
      if (!item) {
        return; // Early return if item creation fails or response was sent
      }

      // Send success response with the created item
      res
        .status(201)
        .json(ApiResponse(item, "item created successfully", true, 201));
    } catch (error) {
      console.error(error); // Log error for debugging
      res
        .status(500)
        .json(
          ApiResponse(null, "Item creation failed", false, 500, error.message)
        );
    }
  }
);

// GET /api/items/totalItemCount
// Retrieves the total number of items (authenticated users only)
itemRouter.get(
  "/totalItemCount",
  verifyToken,
  itemController.getTotalItemCount
);

// GET /api/items/
// Retrieves all items (public access)
itemRouter.get("/", itemController.getAllItems);

// POST /api/items/filter
// Retrieves items based on filter criteria (e.g., category, subcategory, price)
itemRouter.post("/filter", itemController.getItemsByFilter);

// GET /api/items/:id
// Retrieves a single item by its ID (public access)
itemRouter.get("/:id", itemController.getItemById);

// GET /api/items/latest-items/:subCategoryId
// Retrieves the latest items for a specific subcategory (public access)
itemRouter.get(
  "/latest-items/:subCategoryId",
  itemController.getLatestItemsBySubCategory
);

// GET /api/items/subcategory/:subCategoryId
// Retrieves all items for a specific subcategory (public access)
itemRouter.get(
  "/subcategory/:subCategoryId",
  itemController.getItemsBySubCategory
);

// PUT /api/items/:id
// Updates an existing item with an optional image upload (admin-only)
itemRouter.put(
  "/:id",
  verifyToken, // Ensure user is authenticated
  checkAdminRole, // Ensure user has admin role
  upload.single("image"), // Handle single file upload (field name: "image")
  async (req, res) => {
    try {
      // Check if the item exists
      const existingItems = await Item.findById(req.params.id);
      console.log("existingItems", existingItems); // Log existing item for debugging
      if (!existingItems) {
        return res
          .status(404)
          .json(ApiResponse(null, "itmes not found", false, 404));
      }

      // Get the associated subcategory and category
      const existingSubCategory = await SubCategory.findOne({
        _id: existingItems.subCategoryId,
      });
      if (!existingSubCategory) {
        return res
          .status(404)
          .json(ApiResponse(null, "SubCategory not found", false, 404));
      }
      const categoryId = existingSubCategory.categoryId; // Get associated category ID

      // If a new image is uploaded, delete the old image from S3
      if (req.file && existingItems.imageUrl) {
        await deleteFileFromS3(existingItems.imageUrl);
      }

      // If a new image is uploaded, upload it to S3 and update the image URL
      if (req.file) {
        const fileUrl = await uploadMultipart(
          req.file,
          `categories/${categoryId}/${existingSubCategory._id}`,
          req.params.id || "default"
        );
        req.body.imageUrl = fileUrl; // Attach new image URL to request body
      }

      // Call the controller to update the item
      const updatedItem = await itemController.updateItem(req, res);

      // Send success response with the updated item
      res.status(200).json(updatedItem);
    } catch (error) {
      // Send error response if update fails
      res
        .status(500)
        .json(
          ApiResponse(null, "Item update failed", false, 500, error.message)
        );
    }
  }
);

// DELETE /api/items/:id
// Deletes an item by its ID (admin-only)
itemRouter.delete(
  "/:id",
  verifyToken,
  checkAdminRole,
  itemController.deleteItem
);




// Export the router for use in the main Express app
module.exports = itemRouter;