// Import required dependencies
const express = require("express"); // Express framework for routing
const cartController = require("../controllers/cartController/CartController"); // Controller for cart-related logic
const cartRoutes = express.Router(); // Initialize an Express router instance
const { verifyToken } = require("../middleware/VerifyToken"); // Middleware to verify JWT tokens

// Define cart-related API endpoints, all protected by JWT verification
cartRoutes
  // POST /api/cart/
  // Adds an item to the authenticated user's cart
  .post("/", verifyToken, cartController.create)

  // GET /api/cart/user
  // Retrieves the cart for the authenticated user
  .get("/user", verifyToken, cartController.getByUserId)

  // PATCH /api/cart/:id
  // Updates a specific cart item (e.g., quantity) by its ID for the authenticated user
  .patch("/:id", verifyToken, cartController.updateById)

  // DELETE /api/cart/:id
  // Deletes a specific cart item by its ID for the authenticated user
  .delete("/:id", verifyToken, cartController.deleteById)

  // DELETE /api/cart/user/delete
  // Clears the entire cart for the authenticated user
  .delete("/user/delete", verifyToken, cartController.deleteByUserId)

  // DELETE /api/cart/item/:itemId
  // Deletes a cart item by the associated item ID (e.g., product ID) for the authenticated user
  .delete("/item/:itemId", verifyToken, cartController.deleteByItemId);

// Export the router for use in the main Express app
module.exports = cartRoutes;