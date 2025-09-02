const mongoose = require("mongoose");
const ItemDetails = mongoose.model("ItemDetails");
const User = mongoose.model("User");

// Create Review
exports.createReview = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { rating, reviewText } = req.body;

    console.log(`[createReview] Processing request - itemId: ${itemId}, userId: ${req.user._id}`);

    if (!itemId) {
      console.warn(`[createReview] Validation failed: itemId is undefined`);
      return res.status(400).json({ message: "Item ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      console.warn(`[createReview] Validation failed: Invalid itemId format - ${itemId}`);
      return res.status(400).json({ message: "Invalid Item ID format" });
    }

    if (!rating || rating < 1 || rating > 5) {
      console.warn(`[createReview] Validation failed: Invalid rating - ${rating}`);
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const itemDetail = await ItemDetails.findOne({ items: itemId });
    if (!itemDetail) {
      console.warn(`[createReview] ItemDetails not found for itemId: ${itemId}`);
      return res.status(404).json({ message: "Item details not found for this item" });
    }

    if (!itemDetail.isReviewSubmissionEnabled) {
      console.warn(`[createReview] Review submission disabled for itemDetailsId: ${itemDetail._id}`);
      return res.status(403).json({ message: "Review submission is disabled for this item" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      console.warn(`[createReview] User not found: ${req.user._id}`);
      return res.status(404).json({ message: "User not found" });
    }

    const existingReview = itemDetail.reviews.find(
      (review) => review.user.toString() === req.user._id.toString()
    );
    if (existingReview) {
      console.warn(`[createReview] Duplicate review detected for user: ${req.user._id}`);
      return res.status(400).json({ message: "User has already reviewed this item" });
    }

    const review = {
      user: req.user._id,
      rating,
      reviewText,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    itemDetail.reviews.push(review);
    itemDetail.markModified("reviews"); // Ensure Mongoose detects the array change

    // Explicitly calculate and update averageRating as a fallback
    const totalRating = itemDetail.reviews.reduce((sum, review) => sum + review.rating, 0);
    itemDetail.averageRating = itemDetail.reviews.length > 0
      ? parseFloat((totalRating / itemDetail.reviews.length).toFixed(2))
      : 0;

    await itemDetail.save();

    console.log(
      `[createReview] Review added successfully - reviewId: ${review._id}, itemDetailsId: ${itemDetail._id}, averageRating: ${itemDetail.averageRating}`
    );
    res.status(201).json({
      message: "Review added",
      review,
      itemDetailId: itemDetail._id,
      averageRating: itemDetail.averageRating,
    });
  } catch (error) {
    console.error(`[createReview] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Reviews by Item ID
exports.getReviews = async (req, res) => {
  try {
    const { itemId } = req.params;
    console.log(`[getReviews] Fetching reviews for itemId: ${itemId}`);

    if (!itemId) {
      console.warn(`[getReviews] Validation failed: itemId is undefined`);
      return res.status(400).json({ message: "Item ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      console.warn(`[getReviews] Validation failed: Invalid itemId format - ${itemId}`);
      return res.status(400).json({ message: "Invalid Item ID format" });
    }

    const itemDetail = await ItemDetails.findOne({ items: itemId }).populate("reviews.user", "name email");
    if (!itemDetail) {
      console.warn(`[getReviews] ItemDetails not found for itemId: ${itemId}`);
      return res.status(404).json({ message: "Item details not found for this item" });
    }

    if (!itemDetail.isReviewDisplayEnabled) {
      console.warn(`[getReviews] Review display disabled for itemDetailsId: ${itemDetail._id}`);
      return res.status(403).json({ message: "Reviews are not displayed for this item" });
    }

    console.log(`[getReviews] Retrieved ${itemDetail.reviews.length} reviews for itemDetailsId: ${itemDetail._id}`);
    res.status(200).json({ itemDetailId: itemDetail._id, reviews: itemDetail.reviews });
  } catch (error) {
    console.error(`[getReviews] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Review
exports.updateReview = async (req, res) => {
  try {
    const { itemId, reviewId } = req.params;
    const { rating, reviewText } = req.body;

    console.log(`[updateReview] Processing update - itemId: ${itemId}, reviewId: ${reviewId}`);

    if (!itemId || !reviewId) {
      console.warn(
        `[updateReview] Validation failed: itemId or reviewId is undefined - itemId: ${itemId}, reviewId: ${reviewId}`
      );
      return res.status(400).json({ message: "Item ID and Review ID are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
      console.warn(
        `[updateReview] Validation failed: Invalid ID format - itemId: ${itemId}, reviewId: ${reviewId}`
      );
      return res.status(400).json({ message: "Invalid Item ID or Review ID format" });
    }

    if (rating && (rating < 1 || rating > 5)) {
      console.warn(`[updateReview] Validation failed: Invalid rating - ${rating}`);
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const itemDetail = await ItemDetails.findOne({ items: itemId });
    if (!itemDetail) {
      console.warn(`[updateReview] ItemDetails not found for itemId: ${itemId}`);
      return res.status(404).json({ message: "Item details not found for this item" });
    }

    const review = itemDetail.reviews.id(reviewId);
    if (!review) {
      console.warn(`[updateReview] Review not found: ${reviewId}`);
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      console.warn(`[updateReview] Unauthorized update attempt by user: ${req.user._id} for review: ${reviewId}`);
      return res.status(403).json({ message: "Not authorized to update this review" });
    }

    if (rating) review.rating = rating;
    if (reviewText !== undefined) review.reviewText = reviewText;
    review.updatedAt = new Date();

    itemDetail.markModified("reviews"); // Ensure Mongoose detects the array change

    // Explicitly calculate and update averageRating as a fallback
    const totalRating = itemDetail.reviews.reduce((sum, review) => sum + review.rating, 0);
    itemDetail.averageRating = itemDetail.reviews.length > 0
      ? parseFloat((totalRating / itemDetail.reviews.length).toFixed(2))
      : 0;

    await itemDetail.save();

    console.log(
      `[updateReview] Review updated successfully - reviewId: ${reviewId}, itemDetailsId: ${itemDetail._id}, averageRating: ${itemDetail.averageRating}`
    );
    res.status(200).json({
      message: "Review updated",
      review,
      itemDetailId: itemDetail._id,
      averageRating: itemDetail.averageRating,
    });
  } catch (error) {
    console.error(`[updateReview] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete Review
exports.deleteReview = async (req, res) => {
  try {
    const { itemId, reviewId } = req.params;

    console.log(`[deleteReview] Processing deletion - itemId: ${itemId}, reviewId: ${reviewId}`);

    if (!itemId || !reviewId) {
      console.warn(
        `[deleteReview] Validation failed: itemId or reviewId is undefined - itemId: ${itemId}, reviewId: ${reviewId}`
      );
      return res.status(400).json({ message: "Item ID and Review ID are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
      console.warn(
        `[deleteReview] Validation failed: Invalid ID format - itemId: ${itemId}, reviewId: ${reviewId}`
      );
      return res.status(400).json({ message: "Invalid Item ID or Review ID format" });
    }

    const itemDetail = await ItemDetails.findOne({ items: itemId });
    if (!itemDetail) {
      console.warn(`[deleteReview] ItemDetails not found for itemId: ${itemId}`);
      return res.status(404).json({ message: "Item details not found for this item" });
    }

    if (!itemDetail.isReviewSubmissionEnabled) {
      console.warn(`[deleteReview] Review submission disabled for itemDetailsId: ${itemDetail._id}`);
      return res.status(403).json({ message: "Review submission is disabled for this item" });
    }

    const review = itemDetail.reviews.id(reviewId);
    if (!review) {
      console.warn(`[deleteReview] Review not found: ${reviewId}`);
      return res.status(404).json({ message: "Review not found" });
    }

    if (req.user.role !== "admin" && review.user.toString() !== req.user._id.toString()) {
      console.warn(`[deleteReview] Unauthorized delete attempt by user: ${req.user._id} for review: ${reviewId}`);
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    itemDetail.reviews.pull(reviewId);
    itemDetail.markModified("reviews"); // Ensure Mongoose detects the array change

    // Explicitly calculate and update averageRating as a fallback
    const totalRating = itemDetail.reviews.reduce((sum, review) => sum + review.rating, 0);
    itemDetail.averageRating = itemDetail.reviews.length > 0
      ? parseFloat((totalRating / itemDetail.reviews.length).toFixed(2))
      : 0;

    await itemDetail.save();

    console.log(
      `[deleteReview] Review deleted successfully - reviewId: ${reviewId}, itemDetailsId: ${itemDetail._id}, averageRating: ${itemDetail.averageRating}`
    );
    res.status(200).json({
      message: "Review deleted",
      itemDetailId: itemDetail._id,
      averageRating: itemDetail.averageRating,
    });
  } catch (error) {
    console.error(`[deleteReview] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Average Rating by Item ID
exports.getAverageRating = async (req, res) => {
  try {
    const { itemId } = req.params;
    console.log(`[getAverageRating] Fetching average rating for itemId: ${itemId}`);

    if (!itemId) {
      console.warn(`[getAverageRating] Validation failed: itemId is undefined`);
      return res.status(400).json({ message: "Item ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      console.warn(`[getAverageRating] Validation failed: Invalid itemId format - ${itemId}`);
      return res.status(400).json({ message: "Invalid Item ID format" });
    }

    const itemDetail = await ItemDetails.findOne({ items: itemId }).select("averageRating isReviewDisplayEnabled");
    if (!itemDetail) {
      console.warn(`[getAverageRating] ItemDetails not found for itemId: ${itemId}`);
      return res.status(404).json({ message: "Item details not found for this item" });
    }

    if (!itemDetail.isReviewDisplayEnabled) {
      console.warn(`[getAverageRating] Rating display disabled for itemDetailsId: ${itemDetail._id}`);
      return res.status(403).json({ message: "Ratings are not displayed for this item" });
    }

    console.log(
      `[getAverageRating] Average rating retrieved: ${itemDetail.averageRating} for itemDetailsId: ${itemDetail._id}`
    );
    res.status(200).json({ itemDetailId: itemDetail._id, averageRating: itemDetail.averageRating });
  } catch (error) {
    console.error(`[getAverageRating] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create Fake Review (Admin, uses itemDetailsId)
exports.createFakeReview = async (req, res) => {
  try {
    const { itemDetailsId } = req.params;
    const { rating, reviewText, userId } = req.body;

    console.log(`[createFakeReview] Processing request - itemDetailsId: ${itemDetailsId}, userId: ${userId}`);

    if (!itemDetailsId || !userId) {
      console.warn(
        `[createFakeReview] Validation failed: itemDetailsId or userId is undefined - itemDetailsId: ${itemDetailsId}, userId: ${userId}`
      );
      return res.status(400).json({ message: "ItemDetails ID and User ID are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemDetailsId) || !mongoose.Types.ObjectId.isValid(userId)) {
      console.warn(
        `[createFakeReview] Validation failed: Invalid ID format - itemDetailsId: ${itemDetailsId}, userId: ${userId}`
      );
      return res.status(400).json({ message: "Invalid ItemDetails ID or User ID format" });
    }

    if (!rating || rating < 1 || rating > 5) {
      console.warn(`[createFakeReview] Validation failed: Invalid rating - ${rating}`);
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const itemDetail = await ItemDetails.findById(itemDetailsId);
    if (!itemDetail) {
      console.warn(`[createFakeReview] ItemDetails not found: ${itemDetailsId}`);
      return res.status(404).json({ message: "Item details not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[createFakeReview] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    const review = {
      user: userId,
      rating,
      reviewText,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    itemDetail.reviews.push(review);
    itemDetail.markModified("reviews"); // Ensure Mongoose detects the array change

    // Explicitly calculate and update averageRating as a fallback
    const totalRating = itemDetail.reviews.reduce((sum, review) => sum + review.rating, 0);
    itemDetail.averageRating = itemDetail.reviews.length > 0
      ? parseFloat((totalRating / itemDetail.reviews.length).toFixed(2))
      : 0;

    await itemDetail.save();

    console.log(
      `[createFakeReview] Fake review added successfully - reviewId: ${review._id}, itemDetailsId: ${itemDetail._id}, averageRating: ${itemDetail.averageRating}`
    );
    res.status(201).json({
      message: "Fake review added",
      review,
      itemDetailId: itemDetail._id,
      averageRating: itemDetail.averageRating,
    });
  } catch (error) {
    console.error(`[createFakeReview] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Review Settings (Admin, uses itemDetailsId)
exports.updateReviewSettings = async (req, res) => {
  try {
    const { itemDetailsId } = req.params;
    const { isReviewDisplayEnabled, isReviewSubmissionEnabled } = req.body;

    console.log(`[updateReviewSettings] Processing request - itemDetailsId: ${itemDetailsId}`);

    if (!itemDetailsId) {
      console.warn(`[updateReviewSettings] Validation failed: itemDetailsId is undefined`);
      return res.status(400).json({ message: "ItemDetails ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(itemDetailsId)) {
      console.warn(`[updateReviewSettings] Validation failed: Invalid itemDetailsId format - ${itemDetailsId}`);
      return res.status(400).json({ message: "Invalid ItemDetails ID format" });
    }

    const updateFields = {};
    if (isReviewDisplayEnabled !== undefined) updateFields.isReviewDisplayEnabled = isReviewDisplayEnabled;
    if (isReviewSubmissionEnabled !== undefined)
      updateFields.isReviewSubmissionEnabled = isReviewSubmissionEnabled;

    if (Object.keys(updateFields).length === 0) {
      console.warn(`[updateReviewSettings] Validation failed: No valid fields provided for update`);
      return res.status(400).json({ message: "No valid settings provided" });
    }

    const itemDetail = await ItemDetails.findByIdAndUpdate(
      itemDetailsId,
      { $set: updateFields },
      { new: true }
    );

    if (!itemDetail) {
      console.warn(`[updateReviewSettings] ItemDetails not found: ${itemDetailsId}`);
      return res.status(404).json({ message: "Item details not found" });
    }

    console.log(
      `[updateReviewSettings] Review settings updated successfully - itemDetailsId: ${itemDetail._id}, updateFields: ${JSON.stringify(updateFields)}`
    );
    res.status(200).json({ message: "Review settings updated", item: itemDetail });
  } catch (error) {
    console.error(`[updateReviewSettings] Server error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};