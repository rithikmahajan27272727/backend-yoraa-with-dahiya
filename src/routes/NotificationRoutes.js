// Import required dependencies
const express = require("express"); // Express framework for routing
const admin = require("firebase-admin"); // Firebase Admin SDK for sending push notifications
const User = require("../models/User"); // Mongoose model for User collection
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens
const Notifications = require("../models/Notifications"); // Mongoose model for Notifications collection
const { uploadMultipart } = require("../utils/S3"); // S3 utility for file uploads
const mongoose = require("mongoose"); // Mongoose for MongoDB operations
const multer = require("multer"); // Middleware for handling file uploads
const router = express.Router(); // Initialize an Express router instance

// Configure multer for in-memory storage (files are stored in memory, not on disk)
const storage = multer.memoryStorage();
const upload = multer({ storage }); // Multer instance for handling single file uploads

// POST /api/notifications/upload-notification-image
// Uploads an image for a notification to AWS S3 (authenticated users only)
router.post(
  "/upload-notification-image",
  verifyToken, // Ensure user is authenticated
  upload.single("image"), // Handle single file upload (field name: "image")
  async (req, res) => {
    console.log("\n[upload-notification-image] Request received."); // Debug log
    try {
      // Check if an image file was uploaded
      if (!req.file) {
        console.log("❌ No file uploaded.");
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      // Generate a new MongoDB ObjectId for the notification image
      const notificationId = new mongoose.Types.ObjectId().toString();
      console.log("🔍 Uploading file to S3 with ID:", notificationId); // Debug log

      // Upload the image to AWS S3 in the "notifications" folder
      const fileUrl = await uploadMultipart(req.file, "notifications", notificationId);
      console.log("✅ File uploaded successfully:", fileUrl); // Log S3 URL

      // Send success response with the image URL
      res.status(200).json({ success: true, imageUrl: fileUrl });
    } catch (error) {
      console.error("❌ Error uploading notification image:", error); // Log error
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/notifications/send-notification
// Sends a push notification to users via Firebase Cloud Messaging (authenticated users only)
router.post(
  "/send-notification",
  verifyToken, // Ensure user is authenticated
  async (req, res) => {
    console.log("\n[send-notification] Request received."); // Debug log
    const { title, body, imageUrl, deepLink, targetPlatform = "both" } = req.body; // Extract request body
    console.log(
      "Title:",
      title,
      "Body:",
      body,
      "Image URL:",
      imageUrl,
      "Deep Link:",
      deepLink,
      "Target Platform:",
      targetPlatform
    ); // Log request data

    // Validate required fields (title and body)
    if (!title || !body) {
      console.log("❌ Missing title or body.");
      return res
        .status(400)
        .json({ message: "Title and body are required" });
    }

    // Validate imageUrl format if provided
    if (imageUrl && !imageUrl.startsWith("http")) {
      console.log("❌ Invalid imageUrl format. Must start with http:// or https://");
      return res
        .status(400)
        .json({ message: "Invalid imageUrl format" });
    }

    try {
      // Fetch users based on the target platform (android, ios, or both)
      console.log("🔍 Fetching users for platform:", targetPlatform);
      let users =
        targetPlatform === "both"
          ? await User.find({}, "fcmToken platform") // Get all users
          : await User.find({ platform: targetPlatform }, "fcmToken platform"); // Get users by platform

      // Extract valid FCM tokens (filter out null/undefined tokens)
      const tokens = users.map((user) => user.fcmToken).filter(Boolean);
      console.log("📲 Found", tokens.length, "valid FCM tokens.");

      // Check if there are any valid tokens
      if (tokens.length === 0) {
        console.log("❌ No FCM tokens found.");
        return res
          .status(400)
          .json({
            message: "No FCM tokens found for the specified platform",
          });
      }

      // Construct the FCM message payload
      const message = {
        notification: {
          title, // Notification title
          body, // Notification body
          image: imageUrl || undefined, // Optional image for top-level notification
        },
        data: {
          deepLink: deepLink || "", // Optional deep link for app navigation
        },
        tokens, // Array of FCM tokens
        android: {
          notification: {
            image: imageUrl || undefined, // Image for Android notifications
          },
        },
        apns: {
          payload: {
            aps: {
              "mutable-content": 1, // Enable iOS image handling
            },
          },
          fcm_options: {
            image: imageUrl || undefined, // Image for iOS notifications
          },
        },
      };

      // Remove undefined image fields to avoid FCM errors
      if (!imageUrl) {
        delete message.notification.image;
        delete message.android.notification.image;
        delete message.apns.fcm_options.image;
        console.log("⚠️ No imageUrl provided; removed image fields from payload.");
      }

      // Save the notification record to MongoDB
      console.log("💾 Saving notification record to DB...");
      await new Notifications({
        title,
        body,
        imageUrl,
        deepLink,
        platform: targetPlatform,
      }).save();

      // Send the notification via FCM
      console.log("📤 Sending notifications...", JSON.stringify(message, null, 2));
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        "✅ Notification sent successfully.",
        JSON.stringify(response, null, 2)
      );

      // Send success response
      res
        .status(200)
        .json({ success: true, message: "Notification sent!", response });
    } catch (error) {
      console.error("❌ Error sending notification:", error); // Log error
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/notifications/notifications
// Retrieves all notifications from the database (authenticated users only)
router.get(
  "/notifications",
  verifyToken, // Ensure user is authenticated
  async (req, res) => {
    console.log("\n[get-notifications] Request received."); // Debug log
    try {
      // Fetch all notifications, sorted by sentAt in descending order (newest first)
      const notifications = await Notifications.find().sort({ sentAt: -1 });
      console.log("✅ Fetched", notifications.length, "notifications.");

      // Send success response with notifications
      res.status(200).json({ success: true, notifications });
    } catch (error) {
      console.error("❌ Error retrieving notifications:", error); // Log error
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Export the router for use in the main Express app
module.exports = router;