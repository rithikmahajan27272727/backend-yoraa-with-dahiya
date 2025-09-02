// Import required dependencies
const express = require("express"); // Express framework for routing
const {
  loginController,
  signUpController,
  resetPassword,
  deleteUser,
  sendVerificationEmail,
  verifyEmail,
  verifyFirebaseOtp,
  signupFirebase,
  loginFirebase,
  logout,
  resendOtp,
  generateOtp,
  getTotalUserCount,
} = require("../controllers/authController/AuthController"); // Authentication controller functions
const { verify } = require("jsonwebtoken"); // JWT verification (unused in this code, consider removing)
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens

// Initialize an Express router instance
const authRouter = express.Router();

// Define authentication-related API routes
authRouter
  // POST /api/auth/login
  // Handles user login (likely with email/password or similar credentials)
  .post("/login", loginController)

  // POST /api/auth/signup
  // Handles user signup (creates a new user account)
  .post("/signup", signUpController)

  // POST /api/auth/verifyFirebaseOtp
  // Verifies an OTP sent via Firebase (e.g., for phone-based authentication)
  .post("/verifyFirebaseOtp", verifyFirebaseOtp)

  // POST /api/auth/generate-otp
  // Generates and sends an OTP (likely via SMS or email, e.g., using 2Factor.in)
  .post("/generate-otp", generateOtp)

  // POST /api/auth/resend-otp (Commented out)
  // Resends an OTP (e.g., if the user didn't receive the first one)
  // .post("/resend-otp", resendOtp)

  // POST /api/auth/signup/firebase
  // Handles Firebase-based signup (creates user with Firebase Authentication)
  .post("/signup/firebase", signupFirebase)

  // POST /api/auth/login/firebase
  // Handles Firebase-based login (authenticates user with Firebase)
  .post("/login/firebase", loginFirebase)

  // POST /api/auth/sendVerificationEmail
  // Sends a verification email to the user (e.g., with a link or code)
  .post("/sendVerificationEmail", sendVerificationEmail)

  // POST /api/auth/verifyEmail
  // Verifies the user's email (e.g., by clicking a link or entering a code)
  .post("/verifyEmail", verifyEmail)

  // POST /api/auth/resetPassword
  // Handles password reset requests (e.g., sends a reset link or updates password)
  .post("/resetPassword", resetPassword)

  // DELETE /api/auth/deleteUser
  // Deletes a user account (protected by JWT verification)
  .delete("/deleteUser", verifyToken, deleteUser)

  // GET /api/auth/totalUsersCount
  // Retrieves the total number of users (protected by JWT verification)
  .get("/totalUsersCount", verifyToken, getTotalUserCount)

  // GET /api/auth/logout
  // Handles user logout (e.g., clears tokens or sessions)
  .get("/logout", logout);

// Export the router for use in the main Express app
module.exports = authRouter;