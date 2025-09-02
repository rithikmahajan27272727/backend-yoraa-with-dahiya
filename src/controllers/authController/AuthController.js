// Import required models and utilities
const User = require("../../models/User"); // User model for database operations
const Otp = require("../../models/OTP"); // OTP model for storing one-time passwords
const bcrypt = require("bcryptjs"); // Library for password hashing and comparison
const { ApiResponse } = require("../../utils/ApiResponse"); // Utility to standardize API responses
const { generateToken } = require("../../utils/generateToken"); // Utility to generate JWT tokens
const { generateOtp } = require("../../utils/generateOtp"); // Utility to generate OTPs (not used in current code)
const UserProfile = require("../../models/UserProfile"); // UserProfile model for additional user data
const { handleFirebaseSignup, loginFirebase } = require('../../services/authService'); // Firebase authentication service functions
const nodemailer = require("nodemailer"); // Library for sending emails
const crypto = require("crypto"); // Node.js crypto module (not used in current code)
const admin = require('../../utils/firebaseConfig'); // Firebase admin SDK configuration

// Controller for regular login using phone number and password
exports.loginController = async (req, res) => {
    try {
        // Extract phone number and password from request body
        const { phNo, password } = req.body;

        // Check if user exists in the database
        const existingUser = await User.findOne({ phNo });

        // Log user details for debugging
        console.log("Existing User", existingUser);

        // Return 404 if user is not found
        if (!existingUser) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Check if the user is verified
        if (!existingUser.isVerified) {
            return res.status(403).json(ApiResponse(null, "User is not verified. Please verify your account first.", false, 403));
        }

        // Compare provided password with stored hashed password
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(400).json(ApiResponse(null, "Invalid credentials", false, 400));
        }

        // Convert Mongoose document to plain object and remove password for security
        const userObject = existingUser.toObject();
        delete userObject.password;

        // Generate JWT token for authenticated user
        const token = await generateToken(userObject);

        // Log generated token for debugging
        console.log("Generated Token:", token);

        // Return success response with token and user data
        return res.status(200).json(ApiResponse({ token, user: userObject }, "Login successful", true, 200));

    } catch (error) {
        // Log error and return 500 response for server errors
        console.error("Error logging in:", error.message);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};

// Controller for user signup
exports.signUpController = async (req, res) => {
    // Log request body for debugging
    console.log("req.body", req.body);
    try {
        console.log("qqqqqqqqqqqqqq00000000000000");

        // Check if user with provided phone number already exists
        const existingUser = await User.findOne({ phNo: req.body.phNo });
        console.log("qqqqqqqqqqqqq11111111111111");

        // Handle cases where user exists
        if (existingUser) {
            // If user exists but is not verified
            if (existingUser.isVerified == false) {
                console.log("qqqqqqqqqqqqqq");
                return res.status(403).json(ApiResponse(null, "User is not verified. Please verify your account first.", false, 403));
            }
            // If user exists and is verified
            if (existingUser.isVerified == true) {
                console.log("qqqqqqqqqqqqqq1111111111111");
                return res.status(403).json(ApiResponse(null, "User is verified registered. Please login", false, 403));
            }
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashedPassword;

        // Create and save new user
        const createdUser = new User(req.body);
        await createdUser.save();

        // Hardcoded OTP for testing (should be replaced with dynamic OTP generation)
        const hardcodedOtp = "1234";
        console.log("This is the generated OTP:", hardcodedOtp);

        // Save OTP in the database with expiration time
        const newOtp = new Otp({
            phNo: req.body.phNo,
            otp: hardcodedOtp,
            expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
        });
        await newOtp.save();

        // Create and save user profile
        const newUserProfile = new UserProfile({
            user: createdUser._id,
        });
        await newUserProfile.save();

        // Return success response
        return res.status(201).json(ApiResponse(null, "Signup successful. OTP sent successfully.", true, 201));
    } catch (error) {
        // Log error and return 500 response
        console.log(error);
        return res.status(500).json(ApiResponse(null, "Error occurred during signup", false, 500));
    }
};

// Controller for OTP verification
exports.verifyOtp = async (req, res) => {
    try {
        // Extract phone number, OTP, and email from request body
        const { phNo, otp, email } = req.body;
        console.log("phNo", phNo);
        console.log("email", email);

        // Find user by phone number or email
        const user = await User.findOne({ phNo });
        const useremail = await User.findOne({ email });

        // Return 404 if user is not found
        if (!user && !useremail) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Find stored OTP for the phone number
        const storedOtp = await Otp.findOne({ phNo });
        console.log("storedOtp", storedOtp);

        // Return 404 if OTP is not found
        if (!storedOtp) {
            return res.status(404).json(ApiResponse(null, "OTP not found", false, 404));
        }

        // Check if OTP has expired
        if (storedOtp.expiresAt.getTime() < Date.now()) {
            await Otp.deleteOne({ phNo });
            return res.status(400).json(ApiResponse(null, "OTP has expired", false, 400));
        }

        // Verify provided OTP
        if (storedOtp.otp !== otp) {
            return res.status(400).json(ApiResponse(null, "Invalid OTP", false, 400));
        }

        // Mark user as verified
        const updatedUser = await User.findOneAndUpdate(
            { phNo },
            { $set: { isVerified: true } },
            { new: true }
        );

        // Return 500 if user update fails
        if (!updatedUser) {
            return res.status(500).json(ApiResponse(null, "Failed to update verification status", false, 500));
        }

        // Remove password from user object and generate JWT token
        const userObject = updatedUser.toObject();
        delete userObject.password;
        const token = await generateToken(userObject);

        // Delete OTP after successful verification
        await Otp.deleteOne({ phNo });

        // Return success response with token and user data
        return res.status(200).json(ApiResponse({ token, user: userObject }, "OTP verified successfully", true, 200));

    } catch (error) {
        // Log error and return 500 response
        console.error("Error verifying OTP:", error);
        return res.status(500).json(ApiResponse(null, "Error occurred during OTP verification", false, 500));
    }
};

// Generate OTP for existing user
exports.generateOtp = async (req, res) => {
    // Log request body for debugging
    console.log("req.body", req.body);
    try {
        // Extract phone number from request body
        const { phNo } = req.body;

        // Hardcoded OTP for testing (should be replaced with dynamic OTP)
        const hardcodedOtp = "4321";
        console.log("Generated OTP:", hardcodedOtp);

        // Check if user exists
        const existingUser = await User.findOne({ phNo });
        if (!existingUser) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Delete any existing OTP for the phone number
        await Otp.deleteOne({ phNo });

        // Save new OTP with expiration time
        const newOtp = new Otp({
            phNo: phNo,
            otp: hardcodedOtp,
            expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME),
        });

        await newOtp.save();

        // Return success response
        return res.status(201).json(ApiResponse(null, "OTP sent successfully", true, 201));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error generating OTP:", error);
        return res.status(500).json(ApiResponse(null, "Error generating OTP", false, 500));
    }
};

// Logout user by expiring cookie
exports.logout = async (req, res) => {
    try {
        // Set token cookie to expire immediately
        res.cookie("token", {
            maxAge: 0,
            sameSite: process.env.PRODUCTION === "true" ? "None" : "Lax",
            httpOnly: true,
            secure: process.env.PRODUCTION === "true" ? true : false,
        });
        // Return success response
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        // Log error (no response sent)
        console.log(error);
    }
};

// Firebase signup controller
exports.signupFirebase = async (req, res) => {
    // Log for debugging
    console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqq");
    const { idToken } = req.body;
    console.log("Firebase signup received with ID token:", idToken);

    try {
        // Handle Firebase signup and generate JWT token
        const { token, user } = await handleFirebaseSignup(idToken);
        console.log("JWT token generated:", token);

        // Return success response with token and user data
        return res.status(200).json(ApiResponse({ token, user }, "OTP verified successfully", true, 200));
    } catch (error) {
        // Log error and return 400 response
        console.error("Error during Firebase signup:", error);
        return res.status(400).json(ApiResponse(null, error.message, false, 400));
    }
};

// Firebase login controller
exports.loginFirebase = async (req, res) => {
    const { idToken } = req.body;
    console.log("Firebase login received with ID token:", idToken);

    try {
        // Handle Firebase login and generate JWT token
        const token = await loginFirebase(idToken);
        console.log("JWT token generated:", token);
        // Return success response with token
        res.status(200).json({ token });
    } catch (error) {
        // Log error and return 400 response
        console.error("Error during Firebase login:", error);
        res.status(400).json({ message: error.message });
    }
};

// Firebase OTP verification
exports.verifyFirebaseOtp = async (req, res) => {
    // Log for debugging
    console.log("111111111111111111");
    const { idToken, phNo } = req.body;
    console.log("111111111111111111", req.body);

    try {
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("Decoded Firebase Token:", decodedToken);

        // Validate phone number from token
        if (!decodedToken.phone_number || decodedToken.phone_number !== phNo) {
            return res.status(400).json(ApiResponse(null, "Phone number mismatch", false, 400));
        }

        // Remove country code from phone number
        let phNo1 = phNo.replace('+91', '');
        console.log("Trimmed phone number (phNo1):", phNo1);
        let user = await User.findOne({ phNo: phNo1 });
        console.log("User found:", user);

        // Create or update user
        if (!user) {
            user = new User({ phNo, isVerified: true, isPhoneVerified: true });
            await user.save();
        } else {
            user.isVerified = true;
            user.isPhoneVerified = true;
            await user.save();
        }

        // Generate JWT token
        const token = await generateToken({ _id: user._id, phNo: user.phNo });

        // Return success response with token and user data
        return res.status(200).json(ApiResponse({ token, user }, "OTP verified successfully", true, 200));
    } catch (error) {
        // Log error and return 400 response
        console.error("Error verifying Firebase OTP:", error);
        return res.status(400).json(ApiResponse(null, error.message, false, 400));
    }
};

// Email transporter setup for sending OTP emails
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: "ashishak063@gmail.com", // Email address for sending OTPs
        pass: "enzwlnfhxkqudqrg", // App-specific password for Gmail
    },
});

// Send email verification OTP
exports.sendVerificationEmail = async (req, res) => {
    try {
        // Extract email and phone number from request body
        const { email, phone } = req.body;
        console.log("req.body", req.body);
        const user = await User.findOne({ phNo: phone });
        console.log("user", user);

        // Return 404 if user is not found
        if (!user) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailVerificationToken = otp;
        user.isEmailVerified = false;
        user.email = email;
        user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
        await user.save();

        // Email configuration for OTP
        const mailOptions = {
            from: "ashishak063@gmail.com",
            to: email,
            subject: "Your OTP for Email Verification",
            html: `<p>Your OTP for email verification is:</p>
                   <h2>${otp}</h2>
                   <p>This OTP is valid for 10 minutes.</p>`,
        };

        // Send email with OTP
        await transporter.sendMail(mailOptions);

        // Return success response
        return res.status(200).json(ApiResponse(null, "OTP sent to email", true, 200));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error sending verification email:", error);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};

// Verify email OTP
exports.verifyEmail = async (req, res) => {
    try {
        // Extract email, OTP, and phone number from request body
        const { email, otp, phone } = req.body;
        console.log("req.body", req.body);
        const user = await User.findOne({ phNo: phone });

        // Return 404 if user is not found
        if (!user) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Verify OTP
        if (user.emailVerificationToken !== otp) {
            return res.status(400).json(ApiResponse(null, "Invalid OTP", false, 400));
        }

        // Check if OTP has expired
        if (user.emailVerificationExpires < Date.now()) {
            return res.status(400).json(ApiResponse(null, "OTP expired", false, 400));
        }

        // Mark email as verified and clear OTP data
        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.email = email;
        await user.save();

        // Return success response
        return res.status(200).json(ApiResponse(null, "Email verified successfully", true, 200));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error verifying OTP:", error);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};

// Reset user password
exports.resetPassword = async (req, res) => {
    try {
        // Log request body for debugging
        console.log("req.body", req.body);
        const { phNo, newPassword } = req.body;

        // Validate required fields
        if (!phNo || !newPassword) {
            return res.status(400).json(ApiResponse(null, "Missing required fields", false, 400));
        }

        // Find user by phone number
        const user = await User.findOne({ phNo });
        if (!user) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Hash new password and update user
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        // Return success response
        return res.status(200).json(ApiResponse(null, "Password reset successfully", true, 200));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error resetting password:", error);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};

// Delete a user account
exports.deleteUser = async (req, res) => {
    try {
        // Get user ID from authenticated request
        const userId = req.user._id;
        console.log("qqqqqqqqqqq", userId);

        // Find user by ID
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json(ApiResponse(null, "User not found", false, 404));
        }

        // Delete user from database
        await User.deleteOne({ _id: userId });

        // Return success response
        return res.status(200).json(ApiResponse(null, "User deleted successfully", true, 200));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error deleting user:", error);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};

// Get total number of users
exports.getTotalUserCount = async (req, res) => {
    try {
        // Count total users in the database
        const totalUsers = await User.countDocuments();
        // Return success response with count
        return res.status(200).json(ApiResponse({ totalUsers }, "Total user count fetched successfully", true, 200));
    } catch (error) {
        // Log error and return 500 response
        console.error("Error fetching total user count:", error);
        return res.status(500).json(ApiResponse(null, "Internal server error", false, 500));
    }
};