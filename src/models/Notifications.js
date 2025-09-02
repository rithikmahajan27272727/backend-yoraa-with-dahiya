const mongoose = require("mongoose");

// =============================================
// Schema: Notification
// Purpose: Stores app push notification content
// =============================================
const notificationSchema = new mongoose.Schema(
  {
    // Title of the notification (e.g., "Sale Alert!")
    title: {
      type: String,
      required: true,
    },

    // Message body of the notification
    body: {
      type: String,
      required: true,
    },

    // Optional image URL (used for rich notifications)
    imageUrl: {
      type: String,
      default: null,
    },

    // Optional deep link (e.g., app://product/123 or web fallback)
    deepLink: {
      type: String,
      default: null,
    },

    // Target platform: "android", "ios", or "both"
    platform: {
      type: String,
      enum: ["both", "android", "ios"],
      default: "both",
    },

    // Timestamp of when the notification was sent
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Export the model
const Notifications = mongoose.model("Notification", notificationSchema);
module.exports = Notifications;
