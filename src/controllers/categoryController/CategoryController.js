const Category = require("../../models/Category");
const { ApiResponse } = require("../../utils/ApiResponse");
const { deleteFileFromS3 } = require("../../utils/S3");

// ✅ Create a new category
exports.createCategory = async (req, res, newCategoryId) => {
  try {
    // Ensure image URL is provided (uploaded to S3 beforehand)
    if (!req.body.imageUrl) {
      return res.status(400).json(ApiResponse(null, "Image is required", false, 400));
    }

    // Create and save the new category
    const newCategory = new Category({
      _id: newCategoryId, // ID generated beforehand and passed to this function
      name: req.body.name,
      description: req.body.description,
      imageUrl: req.body.imageUrl, // S3 image URL
    });

    await newCategory.save();
    res.status(201).json(ApiResponse(newCategory, "Category created successfully", true, 201));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

// ✅ Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    // Fetch all categories from DB
    const categories = await Category.find();
    res.status(200).json(ApiResponse(categories, "Categories fetched successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

// ✅ Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    // Find category by ID from URL param
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json(ApiResponse(null, "Category not found", false, 404));
    }
    res.status(200).json(ApiResponse(category, "Category fetched successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

// ✅ Update a category
exports.updateCategory = async (req, res) => {
  try {
    // Find the category to update
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json(ApiResponse(null, "Category not found", false, 404));
    }

    // Update the fields if provided, else retain existing values
    category.name = req.body.name || category.name;
    category.description = req.body.description || category.description;
    category.imageUrl = req.body.imageUrl || category.imageUrl;

    await category.save();
    res.status(200).json(ApiResponse(category, "Category updated successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

// ✅ Delete a category by ID
exports.deleteCategory = async (req, res) => {
  try {
    // Find the category to delete
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json(ApiResponse(null, "Category not found", false, 404));
    }

    // If image URL exists, delete the image from S3
    if (category.imageUrl) {
      await deleteFileFromS3(category.imageUrl);
    }

    // Delete the category document
    await category.deleteOne(); // deleteOne is preferred over remove (deprecated)
    res.status(200).json(ApiResponse(null, "Category deleted successfully", true, 200));

  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

// ✅ Get total number of categories
exports.getTotalCategories = async (req, res) => {
  console.log("qqqqqqqqqqq") // Debug log (can be removed in production)
  try {
    // Count total documents in Category collection
    const count = await Category.countDocuments();
    res.status(200).json(ApiResponse({ totalCategories: count }, "Total categories count fetched successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};
