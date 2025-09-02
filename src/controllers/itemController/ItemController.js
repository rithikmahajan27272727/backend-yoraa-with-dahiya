const Item = require("../../models/Item");
const SubCategory = require("../../models/SubCategory");
const { ApiResponse } = require("../../utils/ApiResponse");
const { deleteFileFromS3 } = require("../../utils/S3");
const mongoose = require("mongoose");

/**
 * Create a new item
 */
exports.createItem = async (req, res, newItemId) => {
  try {
    if (!req.body.imageUrl) {
      return res.status(400).json(ApiResponse(null, "Image is required", false, 400));
    }

    const {
      name, description, price, stock, brand, style, occasion,
      fit, material, discountPrice, subCategoryId, categoryId,
      imageUrl, filters
    } = req.body;

    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      return res.status(500).json(ApiResponse(null, "SubCategory not found", false, 500));
    }

    // Parse and format filters if they exist
    let formattedFilters = [];
    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters); // Parse the stringified filters
        if (Array.isArray(parsedFilters)) {
          formattedFilters = parsedFilters.map(filter => ({
            key: filter.key,
            value: filter.value,
            code: filter.code || "" // Default to empty string if code is missing
          }));
        }
      } catch (error) {
        console.error("Error parsing filters:", error);
        return res.status(400).json(ApiResponse(null, "Invalid filters format", false, 400));
      }
    }

    const newItem = new Item({
      _id: newItemId,
      name,
      description,
      price: Number(price), // Convert to number
      stock: Number(stock),
      subCategoryId,
      brand,
      style: style ? style.split(",") : [], // Convert comma-separated string to array
      occasion: occasion ? occasion.split(",") : [],
      fit: fit ? fit.split(",") : [],
      material: material ? material.split(",") : [],
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      categoryId,
      imageUrl,
      filters: formattedFilters
    });

    await newItem.save();
    res.status(201).json(ApiResponse(newItem, "Item created successfully", true, 201));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, err.message, false, 500));
  }
};

/**
 * Get items by subCategoryId
 */
exports.getItemsBySubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    const { page = 1, limit = 100, filters = {} } = req.body;

    let filterCriteria = { subCategoryId };

    // Apply filters dynamically if provided
    if (filters.brand) filterCriteria.brand = { $in: filters.brand };
    if (filters.style) filterCriteria.style = { $in: filters.style };
    if (filters.occasion) filterCriteria.occasion = { $in: filters.occasion };
    if (filters.fit) filterCriteria.fit = { $in: filters.fit };
    if (filters.material) filterCriteria.material = { $in: filters.material };
    if (filters.minPrice) filterCriteria.price = { $gte: parseFloat(filters.minPrice) };
    if (filters.maxPrice) filterCriteria.price = { ...filterCriteria.price, $lte: parseFloat(filters.maxPrice) };
    if (filters.minRating) filterCriteria.averageRating = { $gte: parseFloat(filters.minRating) };

    const items = await Item.find(filterCriteria)
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    const totalItems = await Item.countDocuments(filterCriteria);

    res.status(200).json(ApiResponse(items, "Items fetched successfully", true, 200, {
      totalPages: Math.ceil(totalItems / limit),
      currentPage: Number(page),
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, "Error fetching items", false, 500, err.message));
  }
};

/**
 * Get items by filters
 */
exports.getItemsByFilter = async (req, res) => {
  console.log("Fetching items with filters...");

  try {
    const { page = 1, limit = 100, filters = {}, searchText = "" } = req.body;
    console.log("Received Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Extracted Filters:", JSON.stringify(filters, null, 2));

    let filterCriteria = {};
    const toObjectId = (id) => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

    // Category/subcategory handling
    let validCategoryIds = [];
    if (filters.categoryId) {
      const categoryIds = Array.isArray(filters.categoryId) ? filters.categoryId : [filters.categoryId];
      validCategoryIds = categoryIds.map(toObjectId).filter(id => id);
      filterCriteria.categoryId = { $in: validCategoryIds };
      console.log("Applied categoryId filter:", JSON.stringify(filterCriteria.categoryId, null, 2));
    }

    if (filters.subCategoryId) {
      const subCategoryIds = Array.isArray(filters.subCategoryId) ? filters.subCategoryId : [filters.subCategoryId];
      const validSubCategoryIds = subCategoryIds.map(toObjectId).filter(id => id);
      console.log("Raw subCategoryIds:", subCategoryIds);
      console.log("Valid subCategoryIds:", validSubCategoryIds);

      if (filters.categoryId && validCategoryIds.length > 0) {
        const validSubCategories = await SubCategory.find({ categoryId: { $in: validCategoryIds } }).distinct("_id");
        console.log("Valid subcategories from DB:", validSubCategories.map(id => id.toString()));
        const filteredSubCategories = validSubCategoryIds.filter(id => validSubCategories.some(validId => validId.equals(id)));
        if (filteredSubCategories.length > 0) {
          filterCriteria.subCategoryId = { $in: filteredSubCategories };
          console.log("Applied subCategoryId filter with category check:", JSON.stringify(filterCriteria.subCategoryId, null, 2));
        } else {
          console.log("No matching subcategories found for categoryId, skipping subCategoryId filter");
        }
      } else {
        filterCriteria.subCategoryId = { $in: validSubCategoryIds };
        console.log("Applied subCategoryId filter:", JSON.stringify(filterCriteria.subCategoryId, null, 2));
      }
    }

    // Handle predefined fields
    if (filters.brand) {
      filterCriteria.brand = { $in: filters.brand };
      console.log("Applied brand filter:", filterCriteria.brand);
    }
    if (filters.style) {
      filterCriteria.style = { $in: filters.style };
      console.log("Applied style filter:", filterCriteria.style);
    }
    if (filters.occasion) {
      filterCriteria.occasion = { $in: filters.occasion };
      console.log("Applied occasion filter:", filterCriteria.occasion);
    }
    if (filters.fit) {
      filterCriteria.fit = { $in: filters.fit };
      console.log("Applied fit filter:", filterCriteria.fit);
    }
    if (filters.material) {
      filterCriteria.material = { $in: filters.material };
      console.log("Applied material filter:", filterCriteria.material);
    }
    if (filters.minPrice) {
      filterCriteria.price = { $gte: parseFloat(filters.minPrice) };
      console.log("Applied minPrice filter:", filterCriteria.price);
    }
    if (filters.maxPrice) {
      filterCriteria.price = { ...filterCriteria.price, $lte: parseFloat(filters.maxPrice) };
      console.log("Applied maxPrice filter:", filterCriteria.price);
    }
    if (filters.minRating) {
      filterCriteria.averageRating = { $gte: parseFloat(filters.minRating) };
      console.log("Applied minRating filter:", filterCriteria.averageRating);
    }

    // Handle dynamic filters from the Item's filters array with case-insensitive matching for both key and value
    const dynamicFilterKeys = Object.keys(filters).filter(
      key => !['categoryId', 'subCategoryId', 'brand', 'style', 'occasion', 'fit', 'material', 'minPrice', 'maxPrice', 'minRating', 'customFilters'].includes(key)
    );
    console.log("Dynamic Filter Keys:", dynamicFilterKeys);

    if (dynamicFilterKeys.length > 0) {
      const filterQueries = dynamicFilterKeys.map(key => {
        const values = Array.isArray(filters[key]) ? filters[key] : [filters[key]];
        // Escape special regex characters and join values with OR (|)
        const escapedValues = values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return {
          "filters.key": { $regex: `^${key}$`, $options: "i" }, // Case-insensitive key matching
          "filters.value": { $regex: escapedValues.join("|"), $options: "i" } // Case-insensitive value matching
        };
      });
      filterCriteria.$and = filterQueries;
      console.log("Applied dynamic filters ($and):", JSON.stringify(filterCriteria.$and, null, 2));
    }

    if (searchText) {
      filterCriteria.$or = [
        { name: { $regex: searchText, $options: "i" } },
        { description: { $regex: searchText, $options: "i" } }
      ];
      console.log("Applied searchText filter ($or):", filterCriteria.$or);
    }

    console.log("Final Filter Criteria:", JSON.stringify(filterCriteria, null, 2));

    const items = await Item.find(filterCriteria)
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));
    console.log("Items found:", JSON.stringify(items, null, 2));

    const totalItems = await Item.countDocuments(filterCriteria);
    console.log("Total items matching criteria:", totalItems);

    const response = {
      success: true,
      message: "Items fetched successfully",
      statusCode: 200,
      data: items,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        pageSize: Number(limit),
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error in getItemsByFilter:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      statusCode: 500,
      error: err.message,
    });
  }
};

/**
 * Get all items (with pagination)
 */
exports.getAllItems = async (req, res) => {
  console.log("qqqqqqqqqqqqqq")
  try {
    const { page = 1, limit = 100 } = req.query;
    const items = await Item.find()
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    const totalItems = await Item.countDocuments();

    res.status(200).json({
      items,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, "Error fetching items", false, 500, err.message));
  }
};

/**
 * Get a single item by ID
 */
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate("subCategoryId");
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching item", error: err.message });
  }
};

/**
 * Update an item
 */
exports.updateItem = async (req, res) => {
  console.log("req.body", req.body);
  try {
    const {
      name, description, price, stock, subCategoryId,
      brand, style, occasion, fit, material, discountPrice,
      categoryId, imageUrl, filters
    } = req.body;

    if (subCategoryId) {
      const subCategory = await SubCategory.findById(subCategoryId);
      if (!subCategory) {
        return res.status(400).json({ message: "SubCategory not found" });
      }
    }

    // Parse and format filters if they exist
    let formattedFilters = [];
    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters); // Parse the stringified filters
        if (Array.isArray(parsedFilters)) {
          formattedFilters = parsedFilters.map(filter => ({
            key: filter.key,
            value: filter.value,
            code: filter.code || "" // Default to empty string if code is missing
          }));
        }
      } catch (error) {
        console.error("Error parsing filters:", error);
        return res.status(400).json({ message: "Invalid filters format" });
      }
    }

    const updateData = {
      name,
      description,
      price: Number(price), // Convert to number
      stock: Number(stock),
      subCategoryId,
      brand,
      style: style ? style.split(",") : [], // Convert comma-separated string to array
      occasion: occasion ? occasion.split(",") : [],
      fit: fit ? fit.split(",") : [],
      material: material ? material.split(",") : [],
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      categoryId,
      imageUrl,
      filters: formattedFilters
    };

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating item", error: err.message });
  }
};

/**
 * Delete an item
 */
exports.deleteItem = async (req, res) => {
  try {
    console.log("params", req.params.id);
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    if (item.imageUrl) {
      await deleteFileFromS3(item.imageUrl);
    }

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting item", error: err.message });
  }
};

/**
 * Get latest items by subCategoryId sorted by timestamp (latest first)
 */
exports.getLatestItemsBySubCategory = async (req, res) => {
  console.log("1111111111111111");
  try {
    const { subCategoryId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    const items = await Item.find({ subCategoryId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    const totalItems = await Item.countDocuments({ subCategoryId });

    res.status(200).json(ApiResponse(items, "Latest items fetched successfully", true, 200, {
      totalPages: Math.ceil(totalItems / limit),
      currentPage: Number(page),
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, "Error fetching latest items", false, 500, err.message));
  }
};

/**
 * Get total item count
 */
exports.getTotalItemCount = async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();

    res.status(200).json(ApiResponse({ totalItems }, "Total item count fetched successfully", true, 200));
  } catch (err) {
    console.error(err);
    res.status(500).json(ApiResponse(null, "Error fetching total item count", false, 500, err.message));
  }
};