// Import required dependencies
const express = require("express"); // Express framework for routing
const multer = require("multer"); // Middleware for handling file uploads
const categoryController = require("../controllers/categoryController/CategoryController"); // Controller for category-related logic
const { uploadMultipart, deleteFileFromS3 } = require("../utils/S3"); // S3 utilities for file upload and deletion
const mongoose = require("mongoose"); // Mongoose for MongoDB operations
const Category = require("../models/Category"); // Mongoose model for Category collection
const { ApiResponse } = require("../utils/ApiResponse"); // Utility to standardize API responses
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens
const checkAdminRole = require("../middleware/checkAdminRole"); // Middleware to restrict access to admins

// Initialize an Express router instance
const CategoryRouter = express.Router();

// Configure multer for in-memory storage (files are stored in memory, not on disk)
const storage = multer.memoryStorage();
const upload = multer({ storage }); // Multer instance for handling file uploads

// POST /api/categories/
// Creates a new category with an optional image upload (admin-only)
CategoryRouter.post(
  "/",
  verifyToken, // Ensure user is authenticated
  checkAdminRole, // Ensure user has admin role
  upload.single("image"), // Handle single file upload (field name: "image")
  async (req, res) => {
    try {
      console.log("req.file", req.file); // Log uploaded file details for debugging
      console.log("req.body", req.body); // Log request body for debugging

      // Check if an image file was uploaded
      if (!req.file) {
        return res
          .status(400)
          .json(ApiResponse(null, "No file uploaded", false, 400));
      }

      // Check for duplicate category name
      const existingCategory = await Category.findOne({ name: req.body.name });
      if (existingCategory) {
        return res
          .status(400)
          .json(ApiResponse(null, "Category name already exists", false, 400));
      }

      // Generate a new MongoDB ObjectId for the category
      const newCategoryId = new mongoose.Types.ObjectId();

      // Upload the image to AWS S3 and get the file URL
      const fileUrl = await uploadMultipart(req.file, "categories", newCategoryId);
      console.log("File uploaded to:", fileUrl); // Log S3 URL for debugging

      // Attach the image URL to the request body for use in the controller
      req.body.imageUrl = fileUrl;

      // Call the controller to create the category
      const category = await categoryController.createCategory(req, res, newCategoryId);

      // Prevent further execution if the controller already sent a response
      if (!category) {
        return; // Early return if category creation fails or response was sent
      }

      // Send success response with the created category
      res
        .status(201)
        .json(ApiResponse(category, "Category created successfully", true, 201));
    } catch (error) {
      console.error(error); // Log error for debugging
      // Ensure no response is sent if headers were already sent
      if (!res.headersSent) {
        res
          .status(500)
          .json(
            ApiResponse(null, "Category creation failed", false, 500, error.message)
          );
      }
    }
  }
);

// GET /api/categories/totalCountCategories
// Retrieves the total number of categories (authenticated users only)
CategoryRouter.get(
  "/totalCountCategories",
  verifyToken,
  categoryController.getTotalCategories
);

// GET /api/categories/
// Retrieves all categories (public access)
CategoryRouter.get("/", categoryController.getAllCategories);

// GET /api/categories/:id
// Retrieves a single category by its ID (public access)
CategoryRouter.get("/:id", categoryController.getCategoryById);

// PUT /api/categories/:id
// Updates an existing category with an optional image upload (admin-only)
CategoryRouter.put(
  "/:id",
  verifyToken, // Ensure user is authenticated
  checkAdminRole, // Ensure user has admin role
  upload.single("image"), // Handle single file upload (field name: "image")
  async (req, res) => {
    try {
      console.log("req.params.id", req.params.id); // Log category ID for debugging

      // Check if the category exists
      const existingCategory = await Category.findById(req.params.id);
      console.log("existingCategory", existingCategory); // Log existing category for debugging
      if (!existingCategory) {
        return res
          .status(404)
          .json(ApiResponse(null, "Category not found", false, 404));
      }

      // If a new image is uploaded, delete the old image from S3
      if (req.file && existingCategory.imageUrl) {
        await deleteFileFromS3(existingCategory.imageUrl);
      }

      // If a new image is uploaded, upload it to S3 and update the image URL
      if (req.file) {
        const fileUrl = await uploadMultipart(req.file, "categories", req.params.id);
        req.body.imageUrl = fileUrl; // Attach new image URL to request body
      }

      // Call the controller to update the category
      const updatedCategory = await categoryController.updateCategory(req, res);

      // Send success response with the updated category
      res.status(200).json(updatedCategory);
    } catch (error) {
      // Send error response if update fails
      res
        .status(500)
        .json(
          ApiResponse(null, "Category update failed", false, 500, error.message)
        );
    }
  }
);

// DELETE /api/categories/:id
// Deletes a category by its ID (admin-only)
CategoryRouter.delete(
  "/:id",
  verifyToken,
  checkAdminRole,
  categoryController.deleteCategory
);

// Note: Duplicate route definition for /totalCountCategories (remove one)
CategoryRouter.get(
  "/totalCountCategories",
  verifyToken,
  categoryController.getTotalCategories
);

// Export the router for use in the main Express app
module.exports = CategoryRouter;