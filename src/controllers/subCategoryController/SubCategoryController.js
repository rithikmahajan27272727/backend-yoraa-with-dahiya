const SubCategory = require("../../models/SubCategory");
const Category = require("../../models/Category");
const { deleteFileFromS3 } = require("../../utils/S3");
const { ApiResponse } = require("../../utils/ApiResponse");

// Create a new subcategory
exports.createSubCategory = async (req, res, newSubCategoryId) => {
  try {
    if (!req.file) {
      return { error: "Image is required" };  // Return an error message instead of sending a response directly
    }

    const category = await Category.findById(req.body.categoryId);
    if (!category) {
      return { error: "Category not found" };  // Return an error message instead of sending a response directly
    }

    const newSubCategory = new SubCategory({
      _id: newSubCategoryId,  // Assign the generated ID
      name: req.body.name,
      description: req.body.description,
      categoryId: req.body.categoryId,
      imageUrl: req.body.imageUrl,  // Image URL from S3
    });

    await newSubCategory.save();
    return newSubCategory;  // Return the subcategory data instead of sending a response
  } catch (err) {
    console.error(err);
    return { error: err.message };  // Return the error message
  }
};


// Get all subcategories
exports.getAllSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find();
    res.status(200).json(subCategories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get a single subcategory by ID
exports.getSubCategoryById = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);
    if (!subCategory) {
      return res.status(404).json({ message: "SubCategory not found" });
    }
    res.status(200).json(subCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get subcategories by category ID
exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const subCategories = await SubCategory.find({ categoryId: req.params.categoryId });

    if (!subCategories || subCategories.length === 0) {
      return res.status(404).json(ApiResponse([], "No subcategories found.", false, 404));
    }

    return res.status(200).json(ApiResponse(subCategories, "Subcategories retrieved successfully.", true, 200));

  } catch (err) {
    console.error("Error fetching subcategories:", err);
    return res.status(500).json(ApiResponse(null, "Internal Server Error.", false, 500));
  }
};


// Update a subcategory
exports.updateSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);
    if (!subCategory) {
      return res.status(404).json(ApiResponse(null, "SubCategory not found", false, 404));
    }

    subCategory.name = req.body.name || subCategory.name;
    subCategory.description = req.body.description || subCategory.description;
    subCategory.categoryId = req.body.categoryId || subCategory.categoryId;
    subCategory.imageUrl = req.body.imageUrl ? req.body.imageUrl : subCategory.imageUrl;

    await subCategory.save();
    res.status(200).json(subCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Delete a subcategory
exports.deleteSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);
    if (!subCategory) {
      return res.status(404).json({ message: "SubCategory not found" });
    }

    if (subCategory.imageUrl) {
      await deleteFileFromS3(subCategory.imageUrl);
    }

    await subCategory.deleteOne();
    res.status(200).json({ message: "SubCategory deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
// Get total subcategory count
exports.getTotalSubCategories = async (req, res) => {
  try {
    const count = await SubCategory.countDocuments();
    res.status(200).json(ApiResponse({ totalSubCategories: count }, "Total subcategories count fetched successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};
