const mongoose = require("mongoose");
const { Schema } = mongoose;

// ==============================
// Cart Schema Definition
// ==============================
const cartSchema = new Schema(
  {
    // Reference to the user who owns this cart item
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Reference to the main item/product
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },

    // Reference to item details (e.g., color, size variations)
    itemDetails: { type: Schema.Types.ObjectId, ref: "ItemDetails", required: true },

    // SKU (Stock Keeping Unit) representing a unique variation (e.g., color-size combination)
    sku: { type: String, required: true },

    // Quantity of the item in the cart (must be at least 1)
    quantity: { type: Number, default: 1, min: 1 },
  },
  {
    timestamps: true,      // Adds createdAt and updatedAt fields automatically
    versionKey: false      // Disables the __v version key used by Mongoose
  }
);

// ==============================
// Validation Middleware
// ==============================
// Before saving, validate that the SKU exists within the associated ItemDetails
cartSchema.pre("save", async function (next) {
  const itemDetails = await mongoose.model("ItemDetails").findById(this.itemDetails);

  // Check if itemDetails is valid
  if (!itemDetails) {
    return next(new Error("Invalid ItemDetails reference"));
  }

  // Check if the provided SKU exists in any of the color/size combinations
  const skuExists = itemDetails.colors.some((color) =>
    color.sizes.some((size) => size.sku === this.sku)
  );

  if (!skuExists) {
    return next(new Error("Invalid SKU provided"));
  }

  next();
});

// Export the Cart model
module.exports = mongoose.model("Cart", cartSchema);
