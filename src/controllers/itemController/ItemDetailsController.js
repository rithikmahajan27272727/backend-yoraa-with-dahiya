const ItemDetails = require("../../models/ItemDetails");
const Item = require("../../models/Item");
const { uploadMultipart, deleteFileFromS3 } = require("../../utils/S3");
const XLSX = require("xlsx");

const parseExcelToSizeChart = (file) => {
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const headers = jsonData[0];
  const rows = jsonData.slice(1);

  return rows.map(row => ({
    measurements: headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {}),
  }));
};
const processMediaUploads = async (files, subCategoryId, itemId, colorNames = []) => {
  const imageFiles = files?.images || [];
  const videoFiles = files?.videos || [];
  const allFiles = [...imageFiles, ...videoFiles];

  if (allFiles.length === 0) return [];

  const colorDataMap = new Map();

  // Initialize colorDataMap with colors from req.body.colors
  colorNames.forEach(color => colorDataMap.set(color, { color, images: [], sizes: [] }));

  // Create an array of upload promises
  const uploadPromises = allFiles.map(async (file, index) => {
    const inferredColor = file.originalname.split("_")[0];
    const targetColor = colorNames.includes(inferredColor) 
      ? inferredColor 
      : colorNames[index % colorNames.length] || colorNames[0];

    const type = file.fieldname === "images" ? "image" : "video";
    console.log(`[Server] Uploading ${file.originalname} for color ${targetColor}`);
    const url = await uploadMultipart(
      file,
      `categories/${subCategoryId}/${itemId}`,
      `${targetColor}_${type}_${index}`
    );
    console.log(`[Server] Uploaded ${file.originalname} to ${url}`);

    if (!colorDataMap.has(targetColor)) {
      colorDataMap.set(targetColor, { color: targetColor, images: [], sizes: [] });
    }
    colorDataMap.get(targetColor).images.push({ url, type, priority: index });
  });

  // Wait for all uploads to complete
  await Promise.all(uploadPromises);

  console.log("[Server] All uploads completed, colorDataMap:", Array.from(colorDataMap.values()));
  return Array.from(colorDataMap.values());
};

exports.createItemDetails = async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemExists = await Item.findById(itemId);
    if (!itemExists) {
      return res.status(404).json({ error: "Item not found" });
    }

    console.log("[Server] req.body:", req.body);

    let itemDetailsData = req.body.data ? JSON.parse(req.body.data) : {};
    console.log("[Server] Parsed itemDetailsData:", itemDetailsData);

    // Ensure arrays are properly formatted
    itemDetailsData.fitDetails = Array.isArray(itemDetailsData.fitDetails) ? itemDetailsData.fitDetails : [];
    itemDetailsData.shippingAndReturns = itemDetailsData.shippingAndReturns || {
      shippingDetails: [],
      returnPolicy: [],
    };

    // Parse the colors field from req.body.colors
    const colorNames = req.body.colors ? JSON.parse(req.body.colors) : [];
    console.log("[Server] Color names from req.body.colors:", colorNames);

    // Process media uploads with colorNames
    const colors = await processMediaUploads(req.files, itemExists.subCategoryId, itemId, colorNames);
    console.log("[Server] Colors from processMediaUploads:", colors);

    // Merge sizes from itemDetailsData into the colors array
    if (itemDetailsData.colors) {
      itemDetailsData.colors.forEach(dataColor => {
        const colorEntry = colors.find(c => c.color === dataColor.color);
        if (colorEntry) {
          colorEntry.sizes = dataColor.sizes || [];
        } else {
          colors.push({
            color: dataColor.color,
            images: [],
            sizes: dataColor.sizes || [],
          });
        }
      });
    }
    console.log("[Server] Colors after merging sizes:", colors);

    let sizeChartInch = [];
    let sizeChartCm = [];
    let sizeMeasurement = null;

    if (req.files?.sizeChartInch?.[0]) {
      sizeChartInch = parseExcelToSizeChart(req.files.sizeChartInch[0]);
    }
    if (req.files?.sizeChartCm?.[0]) {
      sizeChartCm = parseExcelToSizeChart(req.files.sizeChartCm[0]);
    }
    if (req.files?.sizeMeasurement?.[0]) {
      sizeMeasurement = await uploadMultipart(
        req.files.sizeMeasurement[0],
        `categories/${itemExists.subCategoryId}/${itemId}`,
        `sizeMeasurement_${Date.now()}`
      );
    }

    const newItemDetails = new ItemDetails({
      ...itemDetailsData,
      colors,
      sizeChartInch,
      sizeChartCm,
      sizeMeasurement,
      items: itemId,
    });

    console.log("[Server] newItemDetails before save:", newItemDetails);

    itemExists.isItemDetail = true;
    await itemExists.save();
    const savedDetails = await newItemDetails.save();

    console.log("[Server] Saved ItemDetails:", savedDetails);

    res.status(201).json(savedDetails);
  } catch (error) {
    console.error("[ERROR] in createItemDetails:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateItemDetails = async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemExists = await Item.findById(itemId);
    if (!itemExists) {
      return res.status(404).json({ error: "Item not found" });
    }

    const existingDetails = await ItemDetails.findOne({ items: itemId });
    if (!existingDetails) {
      return res.status(404).json({ error: "Item Details not found" });
    }

    let itemDetailsData = req.body.data ? JSON.parse(req.body.data) : {};
    let deletedMedia = req.body.deletedMedia ? JSON.parse(req.body.deletedMedia) : [];

    // Preserve existing colors and sizes
    const colors = existingDetails.colors.map(color => ({
      ...color.toObject(),
      images: [...color.images],
      sizes: [...color.sizes],
    }));

    // Handle media deletions
    if (deletedMedia.length > 0) {
      const urlsToDelete = [];
      colors.forEach(color => {
        color.images = color.images.filter(image => {
          const shouldDelete = deletedMedia.some(d => d.url === image.url && d.color === color.color);
          if (shouldDelete) urlsToDelete.push(image.url);
          return !shouldDelete;
        });
      });
      if (urlsToDelete.length > 0) {
        await deleteFileFromS3(urlsToDelete);
      }
    }

    // Handle new media uploads
    const newColors = await processMediaUploads(req.files, itemExists.subCategoryId, itemId);
    newColors.forEach(newColor => {
      const existingColor = colors.find(c => c.color === newColor.color);
      if (existingColor) {
        existingColor.images = [...existingColor.images, ...newColor.images];
      } else {
        colors.push(newColor);
      }
    });

    // Update sizes from request data
    if (itemDetailsData.colors) {
      itemDetailsData.colors.forEach(dataColor => {
        const colorEntry = colors.find(c => c.color === dataColor.color);
        if (colorEntry && dataColor.sizes) {
          colorEntry.sizes = dataColor.sizes;
        } else if (!colorEntry) {
          colors.push({
            color: dataColor.color,
            images: [],
            sizes: dataColor.sizes || [],
          });
        }
      });
    }

    // Update size charts and measurement
    let sizeChartInch = existingDetails.sizeChartInch;
    let sizeChartCm = existingDetails.sizeChartCm;
    let sizeMeasurement = existingDetails.sizeMeasurement;

    if (req.files?.sizeChartInch?.[0]) {
      sizeChartInch = parseExcelToSizeChart(req.files.sizeChartInch[0]);
    }
    if (req.files?.sizeChartCm?.[0]) {
      sizeChartCm = parseExcelToSizeChart(req.files.sizeChartCm[0]);
    }
    if (req.files?.sizeMeasurement?.[0]) {
      if (sizeMeasurement) await deleteFileFromS3([sizeMeasurement]);
      sizeMeasurement = await uploadMultipart(
        req.files.sizeMeasurement[0],
        `categories/${itemExists.subCategoryId}/${itemId}`,
        `sizeMeasurement_${Date.now()}`
      );
    }

    const updatedDetails = await ItemDetails.findOneAndUpdate(
      { items: itemId },
      {
        ...itemDetailsData,
        colors,
        sizeChartInch,
        sizeChartCm,
        sizeMeasurement,
        items: itemId,
      },
      { new: true, runValidators: true }
    ).populate("items");

    res.status(200).json(updatedDetails);
  } catch (error) {
    console.error("Error updating item details", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMediaFromItemDetails = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { mediaUrl, color } = req.body;
    if (!mediaUrl || !color) {
      return res.status(400).json({ error: "Media URL and color are required" });
    }

    const itemDetails = await ItemDetails.findOne({ items: itemId });
    if (!itemDetails) {
      return res.status(404).json({ error: "Item Details not found" });
    }

    const colorGroup = itemDetails.colors.find(c => c.color === color);
    if (!colorGroup) {
      return res.status(404).json({ error: "Color not found" });
    }

    const imageIndex = colorGroup.images.findIndex(img => img.url === mediaUrl);
    if (imageIndex === -1) {
      return res.status(404).json({ error: "Media not found" });
    }

    await deleteFileFromS3([mediaUrl]);
    colorGroup.images.splice(imageIndex, 1);

    if (colorGroup.images.length === 0 && colorGroup.sizes.length === 0) {
      itemDetails.colors = itemDetails.colors.filter(c => c.color !== color);
    }

    await itemDetails.save();
    res.status(200).json({ message: "Media deleted successfully", updatedDetails: itemDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getZeroStockItemDetails = async (req, res) => {
  try {
    const zeroStockItems = await ItemDetails.find({
      "colors.sizes.stock": 0,
    }).populate("items");

    if (zeroStockItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No items with zero stock found",
        data: [],
      });
    }

    const filteredItems = zeroStockItems.map(item => {
      const updatedColors = item.colors.map(color => ({
        ...color.toObject(),
        sizes: color.sizes.filter(size => size.stock === 0),
      })).filter(color => color.sizes.length > 0);
      return {
        ...item._doc,
        colors: updatedColors,
      };
    });

    res.status(200).json({
      success: true,
      message: "Items with zero stock retrieved successfully",
      data: filteredItems,
    });
  } catch (error) {
    console.error("Error fetching zero stock items:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOutOfStockCount = async (req, res) => {
  try {
    const outOfStockCount = await ItemDetails.countDocuments({
      "colors.sizes.stock": 0,
    });

    res.status(200).json({
      success: true,
      message: "Out-of-stock count retrieved successfully",
      count: outOfStockCount,
    });
  } catch (error) {
    console.error("Error counting out-of-stock items:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllItemDetails = async (req, res) => {
  try {
    const details = await ItemDetails.find().populate("items");
    res.status(200).json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getItemDetailsByItemId = async (req, res) => {
  try {
    const { itemId } = req.params;
    const details = await ItemDetails.findOne({ items: itemId }).populate("items");
    if (!details) {
      return res.status(404).json({ error: "Item Details not found for the given Item ID" });
    }
    console.log("details",details)
    res.status(200).json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteItemDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const itemDetails = await ItemDetails.findById(id);
    if (!itemDetails) {
      return res.status(404).json({ error: "Item Details not found" });
    }

    const allMedia = [
      ...itemDetails.colors.flatMap(color => color.images.map(img => img.url)),
      itemDetails.sizeMeasurement,
    ].filter(Boolean);

    if (allMedia.length > 0) {
      await deleteFileFromS3(allMedia);
    }

    await ItemDetails.findByIdAndDelete(id);
    await Item.findByIdAndUpdate(itemDetails.items, { isItemDetail: false });

    res.status(200).json({ message: "Item Details deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
/**
 * Download all item details as JSON, excluding reviews and averageRating
 */
exports.downloadAllItemDetails = async (req, res) => {
  try {
    // Fetch all item details, excluding reviews and averageRating, and populate items
    const itemDetails = await ItemDetails.find()
      .select('-reviews -averageRating') // Exclude reviews and averageRating
      .populate('items', 'productId name') // Populate item details (only productId and name for brevity)
      .lean(); // Convert to plain JavaScript objects for performance

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename="itemDetails.json"');
    res.setHeader('Content-Type', 'application/json');

    // Send pretty-printed JSON with 2-space indentation
    res.status(200).send(JSON.stringify(itemDetails, null, 2));
  } catch (error) {
    console.error('Error downloading item details:', error);
    res.status(500).json(
      ApiResponse(null, 'Error downloading item details', false, 500, error.message)
    );
  }
};