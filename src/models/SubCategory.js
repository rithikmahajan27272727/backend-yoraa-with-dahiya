const mongoose = require("mongoose");
const { deleteFileFromS3 } = require("../utils/S3");

// Define schema for SubCategory
const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Name of the subcategory
    description: { type: String }, // Optional description
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }, // Each SubCategory belongs to 1 Category
    imageUrl: { type: String }, // S3 Image URL for subcategory
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Delete all items, item details, and S3 image when a subcategory is deleted
subCategorySchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  const subCategoryId = this._id; // Get current SubCategory ID

  // Find all items associated with the subcategory
  const items = await mongoose.model("Item").find({ subCategoryId });

  // Loop through each item
  for (const item of items) {
    // Delete related ItemDetails
    await mongoose.model("ItemDetails").deleteOne({ items: item._id });

    // Delete item image from S3 if exists
    if (item.imageUrl) await deleteFileFromS3(item.imageUrl);
  }

  // Delete all items under this subcategory
  await mongoose.model("Item").deleteMany({ subCategoryId });

  // Delete subcategory image from S3 if exists
  if (this.imageUrl) await deleteFileFromS3(this.imageUrl);

  next(); // Proceed to delete the subcategory document
});

// Export the SubCategory model
module.exports = mongoose.model("SubCategory", subCategorySchema);
