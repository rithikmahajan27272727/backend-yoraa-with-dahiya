const Item = require("../../models/Item");
const ItemDetails = require("../../models/ItemDetails");
const SubCategory = require("../../models/SubCategory");
const { bulkUploadFilesToS3, parseImageFilename, cleanupFailedUploads } = require("../../utils/S3");
const { ApiResponse } = require("../../utils/ApiResponse");
const mongoose = require("mongoose");

/**
 * Bulk upload items with primary images
 */
exports.bulkUploadItems = async (req, res) => {
  console.log("Starting bulkUploadItems controller");

  try {
    // Check if JSON file is provided
    console.log("Checking for JSON file in req.files");
    if (!req.files || !req.files.jsonFile || req.files.jsonFile.length === 0) {
      console.error("No JSON file provided");
      return res.status(400).json(ApiResponse(null, "JSON file is required", false, 400));
    }
    console.log("JSON file found:", req.files.jsonFile[0].originalname);

    // Parse JSON file
    const jsonFile = req.files.jsonFile[0];
    let itemsData;
    try {
      console.log("Parsing JSON file");
      itemsData = JSON.parse(jsonFile.buffer.toString());
      if (!Array.isArray(itemsData)) {
        console.error("JSON is not an array");
        return res.status(400).json(ApiResponse(null, "JSON must be an array of items", false, 400));
      }
      console.log(`Parsed ${itemsData.length} items from JSON`);
    } catch (error) {
      console.error("Failed to parse JSON:", error.message);
      return res.status(400).json(ApiResponse(null, "Invalid JSON format", false, 400, error.message));
    }

    const media = req.files.media || []; // Changed from "images" to "media"
    console.log(`Found ${media.length} images`, media.map(img => img.originalname));

    const results = {
      successful: [],
      failed: [],
    };

    // Process items sequentially
    console.log("Starting item processing");
    for (const itemData of itemsData) {
      console.log(`Processing item with productId: ${itemData.productId || "unknown"}`);
      let newItemId = null;
      let uploadedUrls = [];
      try {
        // Validate required fields
        console.log("Validating required fields");
        if (!itemData.productId || !itemData.name || !itemData.price || !itemData.subCategoryId || !itemData.categoryId) {
          throw new Error("Missing required fields: productId, name, price, subCategoryId, categoryId");
        }

        // Validate filters format
        console.log("Validating filters format");
        if (itemData.filters) {
          if (!Array.isArray(itemData.filters)) {
            throw new Error("Filters must be an array of objects");
          }
          for (const filter of itemData.filters) {
            if (!filter || typeof filter !== "object" || !filter.key || !filter.value) {
              throw new Error("Each filter must be an object with 'key' and 'value'");
            }
          }
        }

        // Check for duplicate productId
        console.log("Checking for duplicate productId");
        const existingItem = await Item.findOne({ productId: itemData.productId });
        if (existingItem) {
          throw new Error(`Duplicate productId: ${itemData.productId}`);
        }

        // Verify subCategoryId and categoryId
        console.log("Verifying subCategoryId and categoryId");
        const subCategory = await SubCategory.findOne({
          _id: itemData.subCategoryId,
          categoryId: itemData.categoryId,
        });
        if (!subCategory) {
          throw new Error(`Invalid subCategoryId: ${itemData.subCategoryId} or categoryId: ${itemData.categoryId}`);
        }

        // Generate new item ID
        newItemId = new mongoose.Types.ObjectId();
        console.log(`Generated new item ID: ${newItemId}`);

        // Create item
        console.log("Creating new Item document");
        const newItem = new Item({
          _id: newItemId,
          productId: itemData.productId,
          name: itemData.name,
          description: itemData.description,
          price: Number(itemData.price),
          stock: Number(itemData.stock || 0),
          subCategoryId: itemData.subCategoryId,
          categoryId: itemData.categoryId,
          brand: itemData.brand,
          style: itemData.style || [],
          occasion: itemData.occasion || [],
          fit: itemData.fit || [],
          material: itemData.material || [],
          discountPrice: itemData.discountPrice ? Number(itemData.discountPrice) : undefined,
          filters: itemData.filters || [],
          isItemDetail: false,
        });

        try {
          await newItem.save();
          console.log(`Saved Item document: ${newItemId}`);
        } catch (validationError) {
          console.error(`Validation error for item ${itemData.productId}:`, validationError.message);
          throw new Error(`Item validation failed: ${validationError.message}`);
        }

        // Filter primary images for this item
        console.log("Filtering primary images for item");
        const itemImages = media.filter((img) => { // Changed from "images" to "media"
          const parsed = parseImageFilename(img.originalname);
          console.log(`Parsed filename ${img.originalname}:`, parsed);
          const matches = parsed && parsed.productId.toUpperCase() === itemData.productId.toUpperCase() && parsed.isPrimary;
          if (!matches) {
            console.log(`Image ${img.originalname} does not match productId ${itemData.productId} or is not primary`, parsed);
          }
          return matches;
        });
        console.log(`Found ${itemImages.length} primary images for item ${itemData.productId}`, itemImages.map(img => img.originalname));

        // Require at least one primary image
        if (itemImages.length === 0) {
          throw new Error(`No primary image found for productId: ${itemData.productId}`);
        }

        // Upload images in bulk
        const folder = `categories/${itemData.categoryId}/${itemData.subCategoryId}`;
        console.log(`Uploading images to S3 folder: ${folder}`);
        const startTime = Date.now();
        const uploadResults = await bulkUploadFilesToS3(itemImages, folder, newItemId.toString());
        console.log(`Bulk upload completed in ${(Date.now() - startTime) / 1000} seconds`);

        // Store uploaded URLs for potential cleanup
        uploadedUrls = uploadResults.filter((result) => result.url).map((result) => result.url);
        console.log(`Uploaded ${uploadedUrls.length} images:`, uploadedUrls);

        // Check for failed uploads
        const failedUploads = uploadResults.filter((result) => result.error);
        if (failedUploads.length > 0) {
          console.log(`Bulk upload summary: ${uploadedUrls.length} succeeded, ${failedUploads.length} failed`);
          throw new Error(`Failed to upload ${failedUploads.length} images: ${failedUploads.map((f) => f.originalname).join(", ")}`);
        }
        console.log(`Bulk upload summary: ${uploadedUrls.length} succeeded, 0 failed`);

        // Link primary image
        let primaryImageUrl = null;
        console.log("Linking primary image to Item");
        for (const result of uploadResults) {
          const parsed = parseImageFilename(result.originalname);
          if (!parsed) {
            throw new Error(`Invalid filename format: ${result.originalname}`);
          }
          if (parsed.isPrimary) {
            primaryImageUrl = result.url;
            console.log(`Linking primary image: ${primaryImageUrl}`);
            await Item.updateOne(
              { _id: newItemId },
              { imageUrl: primaryImageUrl }
            );
          }
        }

        results.successful.push({
          productId: itemData.productId,
          itemId: newItemId,
          primaryImageUrl,
        });
        console.log(`Successfully processed item ${itemData.productId}`);
      } catch (error) {
        console.error(`Error processing item ${itemData.productId || "unknown"}:`, error.message);
        // Cleanup uploaded images if any
        if (uploadedUrls.length > 0) {
          console.log(`Cleaning up ${uploadedUrls.length} uploaded images for ${itemData.productId}`);
          await cleanupFailedUploads(uploadedUrls);
        }
        // Delete partially created item if it exists
        if (newItemId) {
          console.log(`Deleting partially created item: ${newItemId}`);
          await Item.deleteOne({ _id: newItemId });
        }
        results.failed.push({
          productId: itemData.productId || "unknown",
          error: error.message,
        });
      }
    }

    // Send response
    console.log("Sending response:", JSON.stringify(results, null, 2));
    return res.status(200).json(ApiResponse(results, "Bulk items upload completed", true, 200));
  } catch (error) {
    console.error("Bulk items upload error:", error.message);
    return res.status(500).json(ApiResponse(null, "Bulk items upload failed", false, 500, error.message));
  }
};

/**
 * Bulk upload item details with images
 */



function parseImageFilenameItemDetails(filename) {
  const regex = /^(.+?)_(.+?)_(\d+)\.(jpg|jpeg|png|mp4)$/i;
  const match = filename.match(regex);
  if (!match) {
    console.error(`Invalid filename format: ${filename}`);
    return null;
  }
  return {
    productId: match[1],
    colorId: match[2],
    priority: parseInt(match[3], 10),
  };
}

exports.bulkUploadItemDetails = async (req, res) => {
  try {
    // Check if files are present
    if (!req.files || !req.files.jsonFile || !req.files.media) {
      return res.status(400).json({ error: "JSON file and media files are required" });
    }

    // Get JSON file
    const jsonFile = req.files.jsonFile[0];
    if (!jsonFile || jsonFile.mimetype !== "application/json") {
      return res.status(400).json({ error: "Valid JSON file is required" });
    }

    console.log("JSON file found:", jsonFile.originalname);
    const itemDetailsData = JSON.parse(jsonFile.buffer.toString());
    console.log(`Parsed ${itemDetailsData.length} item details from JSON`);

    // Get media files
    const mediaFiles = req.files.media;
    console.log("Found media files:", mediaFiles.map((f) => f.originalname));

    const summary = { successful: [], failed: [] };

    for (const itemData of itemDetailsData) {
      console.log(`Processing item details for productId: ${itemData.productId}`);

      // Find the corresponding Item
      const item = await Item.findOne({ productId: itemData.productId });
      if (!item) {
        console.log(`Item not found for productId: ${itemData.productId}`);
        summary.failed.push({ productId: itemData.productId, error: "Item not found" });
        continue;
      }

      // Filter media files for this product
      const itemMedia = mediaFiles.filter((media) => {
        const parsed = parseImageFilenameItemDetails(media.originalname);
        const isMatch = parsed && parsed.productId.toUpperCase() === itemData.productId.toUpperCase();
        if (!isMatch) {
          console.log(`Media ${media.originalname} does not match productId ${itemData.productId}`);
        }
        return isMatch;
      });
      console.log(`Found ${itemMedia.length} media files for ${itemData.productId}:`, itemMedia.map((m) => m.originalname));

      // Upload media files to S3
      const s3Folder = `categories/${item.categoryId}/${item.subCategoryId}/${item._id}`;
      console.log(`Uploading media files to S3 folder: ${s3Folder}`);
      const uploadResults = await bulkUploadFilesToS3(itemMedia, s3Folder);
      console.log(`Uploaded ${uploadResults.length} media files for ${itemData.productId}`);

      // Process images for each color
      for (const color of itemData.colors) {
        const colorMedia = itemMedia.filter((media) => {
          const parsed = parseImageFilenameItemDetails(media.originalname);
          const isMatch = parsed && parsed.colorId.toLowerCase() === color.colorId.toLowerCase();
          if (!isMatch) {
            console.log(`Media ${media.originalname} does not match colorId ${color.colorId} for ${itemData.productId}`);
          }
          return isMatch;
        });

        if (colorMedia.length === 0) {
          console.log(`No images found for color ${color.colorId} in ${itemData.productId}`);
          color.images = [];
        } else {
          color.images = colorMedia.map((media, index) => {
            const parsed = parseImageFilenameItemDetails(media.originalname);
            const uploadResult = uploadResults.find((result) => result.originalname === media.originalname);
            return {
              url: uploadResult.url,
              type: media.mimetype.startsWith("image") ? "image" : "video",
              priority: parsed.priority || index + 1,
            };
          });
          console.log(`Assigned ${color.images.length} images for color ${color.colorId} in ${itemData.productId}:`, color.images);
        }
      }

      // Save ItemDetails
      itemData.items = item._id;
      const itemDetails = new ItemDetails(itemData);
      try {
        await itemDetails.save();
        console.log(`Successfully saved item details for ${itemData.productId}`);
        summary.successful.push({
          productId: itemData.productId,
          itemDetailsId: itemDetails._id,
          itemId: item._id,
        });
      } catch (saveError) {
        console.error(`Failed to save item details for ${itemData.productId}:`, saveError);
        summary.failed.push({ productId: itemData.productId, error: saveError.message });
      }
    }

    console.log("Bulk upload completed. Summary:", summary);
    return res.status(200).json({ message: "Bulk upload completed", summary });
  } catch (error) {
    console.error("Error in bulkUploadItemDetails:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};