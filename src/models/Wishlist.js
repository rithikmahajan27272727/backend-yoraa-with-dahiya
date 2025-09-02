const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Wishlist Schema
const wishlistSchema = new Schema(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    }, // Reference to the user who owns the wishlist

    item: { 
      type: Schema.Types.ObjectId, 
      ref: "Item", 
      required: true 
    }, // Reference to the item in the wishlist
  },
  { 
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    versionKey: false // Disables the "__v" version key
  }
);

// Export the Wishlist model
module.exports = mongoose.model("Wishlist", wishlistSchema);
