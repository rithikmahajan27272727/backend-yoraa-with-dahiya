/**
 * Creates a standardized API response object.
 * @param {any} data - The data to include in the response (e.g., user object, list of items). Defaults to null if not provided.
 * @param {string} message - A message describing the result of the operation (e.g., "User created successfully").
 * @param {boolean} success - Indicates whether the operation was successful (true) or failed (false).
 * @param {number} statusCode - The HTTP status code for the response (e.g., 200, 400, 500).
 * @returns {Object} - A standardized response object with success, message, data, and statusCode properties.
 */
exports.ApiResponse = (data, message, success, statusCode) => {
    return {
      success, // Boolean indicating operation success or failure
      message, // Descriptive message for the response
      data: data || null, // Response data (null if no data is provided)
      statusCode, // HTTP status code
    };
  };