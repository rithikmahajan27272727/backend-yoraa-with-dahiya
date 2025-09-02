const mongoose = require("mongoose");

// ==============================
// Filter Schema Definition
// ==============================
const filterSchema = new mongoose.Schema(
  {
    // Key for the filter (e.g., color, size, brand)
    key: {
      type: String,
      trim: true,
      lowercase: true,
      required: true, // Ensure key is required
    },

    // Priority for the filter key (e.g., color: 1, size: 2)
    priority: {
      type: Number,
      required: true,
      min: 1, // Enforce positive integers
      default: 1, // Default priority if not specified
    },

    // Array of possible values for this filter
    values: [
      {
        // Display name of the value (e.g., Red, Medium, Nike)
        name: {
          type: String,
          required: true,
          trim: true,
        },

        // Optional code (e.g., hex code for colors like "#FF0000")
        code: {
          type: String,
        },

        // Priority for the value (e.g., red: 1, green: 2)
        priority: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export the Filter model
module.exports = mongoose.model("Filter", filterSchema);