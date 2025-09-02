// Import the axios library for making HTTP requests
const axios = require("axios");

// Load the API key from environment variables (assumes dotenv is configured in the main app)
const API_KEY = process.env.API_KEY;

/**
 * Generates and sends an OTP to the specified phone number using the 2Factor.in API.
 * @param {string} phoneNumber - The phone number to send the OTP to (e.g., "+919876543210").
 * @returns {Promise<Object>} - The response from the 2Factor.in API (e.g., { Status, Details }).
 * @throws {Error} - If the API request fails, the error is logged but not thrown.
 */
exports.generateOtp = async (phoneNumber) => {
  try {
    // Make a GET request to the 2Factor.in API to generate and send an OTP
    const response = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/${phoneNumber}/AUTOGEN/OTPTEMPLATENAME`
    );

    // Log success message with response data for debugging
    console.log("OTP Sent:", {
      success: "OTP Successfully Sent",
      response: response.data, // Example: { Status: "Success", Details: "session_id" }
    });

    // Return the API response (e.g., contains session ID for OTP verification)
    return response;
  } catch (error) {
    // Log error details for debugging (includes API response if available)
    console.error(
      "Error sending OTP:",
      error.response ? error.response.data : error.message
    );
    // Note: Error is not thrown, so the calling function must check for undefined response
  }
};