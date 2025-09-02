// Import required dependencies
const bcrypt = require("bcryptjs"); // For password hashing (not used in this code, consider removing if unnecessary)
const jwt = require("jsonwebtoken"); // For generating and verifying JSON Web Tokens
const admin = require("../utils/firebaseConfig"); // Firebase Admin SDK instance for server-side operations
const User = require("../models/User"); // Mongoose model for User collection
const UserProfile = require("../models/UserProfile"); // Mongoose model for UserProfile collection
const { ApiResponse } = require("../utils/ApiResponse"); // Utility to standardize API responses

/**
 * Handles Firebase signup by verifying a Firebase ID token, creating a user in MongoDB if needed,
 * and generating a JWT for session management.
 * @param {string} idToken - Firebase ID token from the client (obtained after Firebase Authentication).
 * @returns {Promise<Object>} - An object containing the JWT token and user details.
 * @throws {Error} - If Firebase token verification or user creation fails.
 */
exports.handleFirebaseSignup = async (idToken) => {
  console.log("handleFirebaseSignup"); // Log for debugging
  try {
    // Verify the Firebase ID token to authenticate the user
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid; // Extract Firebase user ID
    console.log("firebaseUid", firebaseUid); // Log Firebase UID for debugging

    // Check if the user already exists in the MongoDB database
    let firebaseUser = await User.findOne({ firebaseUid });
    console.log("firebaseUser", firebaseUser); // Log user data (or null if not found)

    if (!firebaseUser) {
      // Create a new user in MongoDB if not found
      firebaseUser = new User({
        email: decodedToken.email, // Email from Firebase token
        firebaseUid: firebaseUid, // Firebase user ID
        isVerified: true, // Mark as verified (Firebase handles email verification)
        isEmailVerified: true, // Assume email is verified by Firebase
      });
      await firebaseUser.save(); // Save user to MongoDB

      // Create an associated user profile in MongoDB
      const newUserProfile = new UserProfile({
        user: firebaseUser._id, // Reference to the User document
        email: firebaseUser.email, // Email for profile
      });
      await newUserProfile.save(); // Save profile to MongoDB
    }

    // Generate a JWT for the user session
    const token = jwt.sign(
      { _id: firebaseUser._id, email: firebaseUser.email }, // Payload with user ID and email
      process.env.SECRET_KEY, // Secret key for signing (from .env)
      { expiresIn: "1h" } // Token expires in 1 hour
    );
    console.log("token", token); // Log generated token for debugging

    // Decode the JWT to log its payload (for debugging, not required for functionality)
    const decodedToken1 = jwt.decode(token);
    console.log("Decoded inside auth services token payload:", decodedToken1);

    // Construct user object to return
    const userObject = {
      id: firebaseUser._id, // MongoDB user ID
      email: firebaseUser.email, // User email
      isVerified: firebaseUser.isVerified, // Verification status
    };

    // Return token and user details
    return { token, user: userObject };
  } catch (error) {
    console.error("Error during Firebase signup:", error); // Log error for debugging
    throw new Error("Firebase signup failed"); // Throw error to be handled by caller
  }
};

/**
 * Handles Firebase login by verifying a Firebase ID token and generating a JWT for an existing user.
 * @param {string} idToken - Firebase ID token from the client.
 * @returns {Promise<string>} - The generated JWT token.
 * @throws {Error} - If the user is not found or token verification fails.
 */
exports.loginFirebase = async (idToken) => {
  // Verify the Firebase ID token
  const decodedToken = await admin.auth().verifyIdToken(idToken);

  // Find the user in MongoDB by Firebase UID
  const firebaseUser = await User.findOne({ firebaseUid: decodedToken.uid });

  // Throw an error if the user does not exist
  if (!firebaseUser) {
    throw new Error("User not found");
  }

  // Generate a JWT for the user session
  const token = jwt.sign(
    { id: firebaseUser._id, email: decodedToken.email }, // Payload with user ID and email
    process.env.JWT_SECRET, // Secret key for signing (from .env)
    { expiresIn: "1h" } // Token expires in 1 hour
  );

  // Return the generated token
  return token;
};