const Wishlist = require("../../models/Wishlist");
const Item = require("../../models/Item");
const { ApiResponse } = require("../../utils/ApiResponse");

// ✅ Add an item to the wishlist
exports.addToWishlist = async (req, res) => {
    console.log("inside", req.user); // Debugging user info

    try {
        console.log("inside", req.body); // Debugging request body
        const { itemId } = req.body;
        const userId = req.user._id;

        // Check if the item exists in the Item collection
        const itemExists = await Item.findById(itemId);
        if (!itemExists) {
            return res.status(404).json(ApiResponse(null, "Item not found", false, 404));
        }

        // Prevent duplicate wishlist entries
        const alreadyInWishlist = await Wishlist.findOne({ user: userId, item: itemId });
        if (alreadyInWishlist) {
            return res.status(400).json(ApiResponse(null, "Item is already in wishlist", false, 400));
        }

        // Create and save new wishlist item
        const newWishlistItem = new Wishlist({ user: userId, item: itemId });
        await newWishlistItem.save();

        res.status(201).json(ApiResponse(newWishlistItem, "Item added to wishlist", true, 201));
    } catch (error) {
        res.status(500).json(ApiResponse(null, "Server error", false, 500));
    }
};

// ✅ Get all wishlist items for the logged-in user with pagination
exports.getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        let { page, limit } = req.query;

        // Set default pagination values if not provided
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        // Fetch wishlist items with pagination and populate item details
        const wishlist = await Wishlist.find({ user: userId })
            .populate("item")
            .skip(skip)
            .limit(limit);

        // Get total wishlist count for pagination metadata
        const totalItems = await Wishlist.countDocuments({ user: userId });

        res.status(200).json(ApiResponse({
            wishlist,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page
        }, "Wishlist retrieved successfully", true, 200));
    } catch (error) {
        res.status(500).json(ApiResponse(null, "Server error", false, 500));
    }
};

// ✅ Remove a specific item from the wishlist
exports.removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const itemId = req.params.itemId;

        // Remove the item from wishlist for the user
        const wishlistItem = await Wishlist.findOneAndDelete({ user: userId, item: itemId });
        if (!wishlistItem) {
            return res.status(404).json(ApiResponse(null, "Item not found in wishlist", false, 404));
        }

        res.status(200).json(ApiResponse(null, "Item removed from wishlist", true, 200));
    } catch (error) {
        res.status(500).json(ApiResponse(null, "Server error", false, 500));
    }
};

// ✅ Clear the entire wishlist for the user
exports.clearWishlist = async (req, res) => {
    try {
        const userId = req.user._id;

        // Delete all wishlist items for the current user
        await Wishlist.deleteMany({ user: userId });

        res.status(200).json(ApiResponse(null, "Wishlist cleared successfully", true, 200));
    } catch (error) {
        res.status(500).json(ApiResponse(null, "Server error", false, 500));
    }
};
