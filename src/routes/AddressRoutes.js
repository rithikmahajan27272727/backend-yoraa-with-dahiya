// Import required dependencies
const express = require("express"); // Express framework for routing
const addressController = require("../controllers/addressController/AddressController"); // Controller for address-related logic
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens

// Initialize an Express router instance
const router = express.Router();

// Define address-related API routes with JWT verification middleware
router
  // POST /api/address/createAddress
  // Creates a new address for the authenticated user
  .post("/createAddress", verifyToken, addressController.create)

  // GET /api/address/user
  // Retrieves all addresses for the authenticated user
  .get("/user", verifyToken, addressController.getByUserId)

  // PATCH /api/address/updateById/:id
  // Updates an existing address by its ID for the authenticated user
  .patch("/updateById/:id", verifyToken, addressController.updateById)

  // DELETE /api/address/deleteById/:id
  // Deletes an address by its ID for the authenticated user
  .delete("/deleteById/:id", verifyToken, addressController.deleteById);

// Export the router for use in the main Express app
module.exports = router;