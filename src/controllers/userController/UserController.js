const User = require("../../models/User");
const UserProfile = require("../../models/UserProfile");

// ✅ Get the logged-in user's details
exports.getById = async (req, res) => {
    try {
        const id = req.user._id;
        console.log("Fetching user by ID:", id);

        // Get user and convert to plain object
        const result = (await User.findById(id)).toObject();

        // Remove sensitive data
        delete result.password;

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        res.status(500).json({ message: 'Error getting your details, please try again later' });
    }
};

// ✅ Update a user's data by ID (typically for admin use)
exports.updateById = async (req, res) => {
    try {
        const { id } = req.params;

        // Update user with new data and return the updated object
        const updated = (await User.findByIdAndUpdate(id, req.body, { new: true })).toObject();
        delete updated.password;

        res.status(200).json(updated);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: 'Error updating user details, please try again later' });
    }
};

// ✅ Get all users with their profiles (excluding passwords)
exports.getAllUsers = async (req, res) => {
    try {
        // Fetch all user profiles and populate the related user info
        const users = await UserProfile.find({}, { password: 0 }).populate('user'); // Adjust field names if needed

        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Error fetching users, please try again later" });
    }
};
