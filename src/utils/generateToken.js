// Load environment variables from .env file
require("dotenv").config();

// Import the jsonwebtoken library for creating and verifying JWTs
const jwt = require("jsonwebtoken");

/**
 * Generates a JWT token for authentication or password reset.
 * @param {Object} payload - The data to encode in the token (e.g., user ID, email).
 * @param {boolean} [passwordReset=false] - If true, generates a short-lived token for password reset.
 * @returns {string} - The generated JWT token.
 */
exports.generateToken = (payload, passwordReset = false) => {
  // Sign the payload with the secret key and set expiration time
  return jwt.sign(
    payload, // Data to encode (e.g., { userId: "123", email: "user@example.com" })
    process.env.SECRET_KEY, // Secret key for signing the token (from .env)
    {
      expiresIn: passwordReset
        ? process.env.PASSWORD_RESET_TOKEN_EXPIRATION // Short expiration for password reset (e.g., "2m")
        : process.env.LOGIN_TOKEN_EXPIRATION, // Longer expiration for login (e.g., "30d")
    }
  );
};