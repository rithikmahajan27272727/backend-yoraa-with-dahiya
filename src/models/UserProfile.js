const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define UserProfile Schema
const userProfileSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  }, // Reference to associated User

  addresses: [
    { 
      type: Schema.Types.ObjectId, 
      ref: "Address", 
      required: false 
    }
  ], // Array of address references

  email: { 
    type: String, 
    unique: false, 
    required: false 
  }, // Optional email field

  dob: { 
    type: Date, 
    required: false 
  }, // Date of Birth (optional)

  gender: { 
    type: String, 
    enum: ["Male", "Female", "Other"], 
    required: false 
  }, // Gender with predefined options

  anniversary: { 
    type: Date 
  }, // Optional anniversary date

  stylePreferences: [
    String
  ], // Array of user-selected style preferences

  imageUrl: { 
    type: String, 
    required: false 
  }, // Profile image URL
});

// Export the UserProfile model
module.exports = mongoose.model("UserProfile", userProfileSchema);
