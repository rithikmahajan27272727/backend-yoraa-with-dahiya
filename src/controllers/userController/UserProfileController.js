const User = require("../../models/User");
const UserProfile = require("../../models/UserProfile");
const Address = require("../../models/Address"); // Import Address model
const { uploadMultipart } = require("../../utils/S3");
const mongoose = require("mongoose");

// Get User Profile by User ID from Token
exports.getUserProfile = async (req, res) => {
  const userId = req.user._id;
  try {
    const userProfile = await UserProfile.findOne({ user: userId })
      .populate("user")
      .populate("addresses"); // Populate addresses
    if (!userProfile) {
      return res.status(404).json({ message: "User Profile not found" });
    }
    res.json(userProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a New User Profile with Image Upload and Address
exports.createUserProfile = async (req, res) => {
  const userId = req.user._id;
  try {
    const {
      email,
      dob,
      gender,
      anniversary,
      stylePreferences,
      firstName,
      lastName,
      address,
      city,
      state,
      pinCode,
      country,
      phoneNumber,
      type,
    } = req.body;

    // Check if profile already exists
    const existingProfile = await UserProfile.findOne({ user: userId });
    if (existingProfile) {
      return res.status(400).json({ message: "User Profile already exists" });
    }

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadMultipart(req.file, "userProfiles", userId);
    }

    // Create a new address
    const newAddress = new Address({
      user: userId,
      firstName,
      lastName,
      address,
      city,
      state,
      pinCode,
      country,
      phoneNumber,
      type: type || "current", // Default to "current" if not provided
    });
    const savedAddress = await newAddress.save();

    // Create the user profile with the address reference
    const newUserProfile = new UserProfile({
      user: userId,
      addresses: [savedAddress._id], // Add the address ID to the addresses array
      email,
      dob,
      gender,
      anniversary,
      stylePreferences,
      imageUrl,
    });

    const savedProfile = await newUserProfile.save();
    const user = await User.findById(userId);
    user.isProfile = true;
    await user.save();

    res.status(201).json(savedProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update User Profile
exports.updateUserProfile = async (req, res) => {
    const userId = req.user._id;
    try {
      const {
        email,
        dob,
        gender,
        anniversary,
        stylePreferences,
        name,
        phNo,
        firstName,
        lastName,
        address,
        city,
        state,
        pinCode,
        country,
        phoneNumber,
        type,
      } = req.body;
  
      // Prepare the update object dynamically for UserProfile (excluding addresses)
      let updateProfileFields = {};
      if (email) updateProfileFields.email = email;
      if (dob) updateProfileFields.dob = dob;
      if (gender) updateProfileFields.gender = gender;
      if (anniversary) updateProfileFields.anniversary = anniversary;
      if (stylePreferences) updateProfileFields.stylePreferences = stylePreferences;
  
      // Handle image upload if file is provided
      if (req.file) {
        const imageUrl = await uploadMultipart(req.file, "userProfiles", userId);
        updateProfileFields.imageUrl = imageUrl;
      }
  
      // Update or create address
      let addressId;
      if (address || firstName || lastName || city || state || pinCode || country || phoneNumber || type) {
        const existingAddress = await Address.findOne({ user: userId, type: type || "current" });
        if (existingAddress) {
          // Update existing address
          const updateAddressFields = {};
          if (firstName) updateAddressFields.firstName = firstName;
          if (lastName) updateAddressFields.lastName = lastName;
          if (address) updateAddressFields.address = address;
          if (city) updateAddressFields.city = city;
          if (state) updateAddressFields.state = state;
          if (pinCode) updateAddressFields.pinCode = pinCode;
          if (country) updateAddressFields.country = country;
          if (phoneNumber) updateAddressFields.phoneNumber = phoneNumber;
          if (type) updateAddressFields.type = type;
  
          await Address.findByIdAndUpdate(existingAddress._id, updateAddressFields, { new: true });
          addressId = existingAddress._id;
        } else {
          // Create new address
          const newAddress = new Address({
            user: userId,
            firstName,
            lastName,
            address,
            city,
            state,
            pinCode,
            country,
            phoneNumber,
            type: type || "current",
          });
          const savedAddress = await newAddress.save();
          addressId = savedAddress._id;
        }
      }
  
      // Update UserProfile
      let updatedProfile;
      if (Object.keys(updateProfileFields).length > 0 || addressId) {
        const updateQuery = {};
        if (Object.keys(updateProfileFields).length > 0) {
          updateQuery.$set = updateProfileFields; // Set non-address fields
        }
        if (addressId) {
          updateQuery.$addToSet = { addresses: addressId }; // Append addressId to addresses array
        }
  
        updatedProfile = await UserProfile.findOneAndUpdate(
          { user: userId },
          updateQuery,
          { new: true, runValidators: true }
        );
  
        if (!updatedProfile) {
          return res.status(404).json({ message: "User Profile not found" });
        }
      }
  
      // Update User model (name, phone number, email)
      const user = await User.findById(userId);
      user.isProfile = true;
      if (user.isPhoneVerified === false && user.isEmailVerified === true) {
        user.isPhoneVerified = true;
      }
      if (user.isPhoneVerified === true && user.isEmailVerified === false) {
        user.isEmailVerified = true;
      }
  
      if (name) user.name = name;
      if (phNo) user.phNo = phNo;
      if (email) user.email = email;
  
      await user.save();
  
      res.json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          name: user.name,
          phNo: user.phNo,
          email: user.email,
        },
        profile: updatedProfile || {},
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
// Get User Profile by User ID (Params)
exports.getUserProfileById = async (req, res) => {
  const { userId } = req.params;

  try {
    const userProfile = await UserProfile.findOne({ user: userId })
      .populate("user")
      .populate("addresses"); // Populate addresses
    if (!userProfile) {
      return res.status(404).json({ message: "User Profile not found" });
    }
    res.json(userProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};