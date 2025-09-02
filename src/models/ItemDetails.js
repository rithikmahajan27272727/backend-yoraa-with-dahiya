const mongoose = require("mongoose");

const itemDetailsSchema = new mongoose.Schema({
  descriptionAndReturns: {
    type: String,
    required: true,
  },
  fitDetails: [{ type: String, required: false }],
  careInstructions: { type: String, required: false },
  size: {
    modelHeight: { type: String, required: false },
    modelMeasurements: { type: String, required: false },
    modelWearingSize: { type: String, required: false },
  },
  colors: [
    {
      colorId: {
        type: String,
        required: true,
        validate: {
          validator: function (value) {
            const colorIds = this.parent().colors.map(c => c.colorId);
            return colorIds.indexOf(value) === colorIds.lastIndexOf(value);
          },
          message: "colorId must be unique within the colors array"
        }
      },
      color: { type: String, required: true },
      images: [
        {
          url: { type: String, required: true },
          type: { type: String, enum: ["image", "video"], required: true },
          priority: { type: Number, default: 0 },
        },
      ],
      sizes: [
        {
          size: { type: String, required: true },
          stock: { type: Number, required: true, min: 0 },
          sku: {
            type: String,
            required: true,
            validate: {
              validator: function (value) {
                const skus = this.parent().sizes.map(s => s.sku);
                return skus.indexOf(value) === skus.lastIndexOf(value);
              },
              message: "SKU must be unique within the sizes array"
            }
          },
        },
      ],
    },
  ],
  manufacturerDetails: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    countryOfOrigin: { type: String, required: true },
    contactDetails: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },
  },
  shippingAndReturns: {
    shippingDetails: [{ type: String, required: false }],
    returnPolicy: [{ type: String, required: false }],
  },
  sizeChartInch: [
    {
      measurements: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },
  ],
  sizeChartCm: [
    {
      measurements: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },
  ],
  sizeMeasurement: { type: String, required: false },
  dimensions: {
    length: { type: Number, required: false },
    breadth: { type: Number, required: false },
    height: { type: Number, required: false },
    width: { type: Number, required: false },
    weight: { type: Number, required: false },
  },
  items: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  productId: { type: String, required: true },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      reviewText: { type: String, required: false, trim: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }
  ],
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  isReviewDisplayEnabled: { type: Boolean, default: true },
  isReviewSubmissionEnabled: { type: Boolean, default: true }
});

itemDetailsSchema.post('save', async function (doc) {
  const reviews = doc.reviews;
  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    doc.set('averageRating', parseFloat((totalRating / reviews.length).toFixed(2)));
  } else {
    doc.set('averageRating', 0);
  }
});

itemDetailsSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) {
    const reviews = doc.reviews;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      doc.set('averageRating', parseFloat((totalRating / reviews.length).toFixed(2)));
    } else {
      doc.set('averageRating', 0);
    }
  }
});

module.exports = mongoose.model("ItemDetails", itemDetailsSchema);