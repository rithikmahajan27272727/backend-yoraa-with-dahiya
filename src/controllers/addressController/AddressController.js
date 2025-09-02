const Address = require("../../models/Address");
const { ApiResponse } = require("../../utils/ApiResponse");

// Create Address
exports.create = async (req, res) => {
  try {
    const userId = req.user._id; // Extracting userId from token
    const { type } = req.body;

    // Ensure user does not have more than one 'current' or 'new' address
    const existingAddress = await Address.findOne({ user: userId, type });

    if (existingAddress && type === "current") {
      return res.status(400).json(ApiResponse(null, "A current address already exists!", false, 400));
    }

    // Create new address with userId from token
    const address = new Address({ ...req.body, user: userId });
    await address.save();

    res.status(201).json(ApiResponse(address, "Address added successfully", true, 201));
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json(ApiResponse(null, "Server error", false, 500));
  }
};

// Get Addresses by User ID (from Token)
exports.getByUserId = async (req, res) => {
  try {
    const userId = req.user._id; // Extracting userId from token
    const addresses = await Address.find({ user: userId });

    if (!addresses.length) {
      return res.status(404).json(ApiResponse(null, "No addresses found", false, 404));
    }

    res.status(200).json(ApiResponse(addresses, "Addresses fetched successfully", true, 200));
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json(ApiResponse(null, "Server error", false, 500));
  }
};

// Update Address by ID
exports.updateById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Ensure only the owner can update their address
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      req.body,
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json(ApiResponse(null, "Address not found or unauthorized", false, 404));
    }

    res.status(200).json(ApiResponse(updatedAddress, "Address updated successfully", true, 200));
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json(ApiResponse(null, "Server error", false, 500));
  }
};

// Delete Address by ID
exports.deleteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Ensure only the owner can delete their address
    const deletedAddress = await Address.findOneAndDelete({ _id: id, user: userId });

    if (!deletedAddress) {
      return res.status(404).json(ApiResponse(null, "Address not found or unauthorized", false, 404));
    }

    res.status(200).json(ApiResponse(null, "Address deleted successfully", true, 200));
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json(ApiResponse(null, "Server error", false, 500));
  }
};
