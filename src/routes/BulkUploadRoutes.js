const express = require("express");
const router = express.Router();
const multer = require("multer");
const { verifyToken } = require("../middleware/VerifyToken");
const checkAdminRole = require("../middleware/CheckAdminRole");
const itemBulkUploadController = require("../controllers/bulkUpload/BulkUpload");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
}).fields([
  { name: "jsonFile", maxCount: 1 },
  { name: "media", maxCount: 500 }, // Changed from "images" to "media"
]);

router.post(
  "/bulk-upload",
  verifyToken,
  checkAdminRole,
  upload,
  itemBulkUploadController.bulkUploadItems
);

router.post(
  "/item-details/bulk-upload",
  verifyToken,
  checkAdminRole,
  upload,
  itemBulkUploadController.bulkUploadItemDetails
);

module.exports = router;