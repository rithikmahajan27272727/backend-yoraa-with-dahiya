const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define User Schema
const userSchema = new Schema({
  name: {
    type: String,
    required: false, // Optional name field
  },
  phNo: {
    type: String,
    unique: false, // Phone number doesn't have to be unique
    required: false,
    default: "1234567890", // Default phone number
  },
  password: {
    type: String,
    required: false, // Optional password (for flexibility with OTP or social logins)
  },
  isVerified: {
    type: Boolean,
    default: false, // General verification status
  },
  isPhoneVerified: {
    type: Boolean,
    default: false, // Whether phone number is verified
  },
  isEmailVerified: {
    type: Boolean,
    default: false, // Whether email is verified
  },
  isAdmin: {
    type: Boolean,
    default: false, // Admin flag for backend access or special permissions
  },
  isProfile: {
    type: Boolean,
    default: false, // Whether the user has completed their profile
  },
  email: {
    type: String,
    required: false,
    unique: false, // Email doesn't have to be unique
    default: "demo@example.com", // Default email
  },
  firebaseUid: {
    type: String,
    required: false, // UID from Firebase Auth if used
  },
  fcmToken: {
    type: String,
    unique: false, // FCM token for push notifications
  },
  platform: {
    type: String,
    enum: ["android", "ios"],
    default: null, // Platform type (for push or analytics)
  },
  emailVerificationToken: {
    type: String,
    required: false, // Token for verifying email
  },
});

// Export the User model
module.exports = mongoose.model("User", userSchema);
