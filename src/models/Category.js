const mongoose = require("mongoose");
const { deleteFileFromS3 } = require("../utils/S3");

// ==============================
// Category Schema Definition
// ==============================
const categorySchema = new mongoose.Schema(
  {
    // Unique name for the category
    name: { type: String, required: true, unique: true },

    // Optional description of the category
    description: { type: String },

    // Image URL stored in S3 for category display
    imageUrl: { type: String },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// ===================================================
// Middleware: Pre-deletion cleanup
// When a Category document is deleted, also:
// - Delete related SubCategories
// - Delete related Items and ItemDetails
// - Delete related images from S3
// ===================================================
categorySchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  const categoryId = this._id;

  // Get all subcategories associated with this category
  const subCategories = await mongoose.model("SubCategory").find({ categoryId });

  for (const subCategory of subCategories) {
    // Get all items under the current subcategory
    const items = await mongoose.model("Item").find({ subCategoryId: subCategory._id });

    for (const item of items) {
      // Delete item details associated with each item
      await mongoose.model("ItemDetails").deleteOne({ items: item._id });

      // Delete item image from S3 if it exists
      if (item.imageUrl) await deleteFileFromS3(item.imageUrl);
    }

    // Delete all items under the subcategory
    await mongoose.model("Item").deleteMany({ subCategoryId: subCategory._id });

    // Delete subcategory image from S3 if it exists
    if (subCategory.imageUrl) await deleteFileFromS3(subCategory.imageUrl);
  }

  // Delete all subcategories under the category
  await mongoose.model("SubCategory").deleteMany({ categoryId });

  // Delete the category image from S3 if it exists
  if (this.imageUrl) await deleteFileFromS3(this.imageUrl);

  next();
});

// Export the Category model
module.exports = mongoose.model("Category", categorySchema);
