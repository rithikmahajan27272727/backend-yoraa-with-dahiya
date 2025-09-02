// Import required dependencies
const express = require("express"); // Express framework for routing
const router = express.Router(); // Initialize an Express router instance
const filterController = require("../controllers/filter/FilterController"); // Controller for filter-related logic

// Define filter-related API endpoints
router
  // POST /api/filters/
  // Creates a new filter (e.g., for product attributes like size, color, or price range)
  .post("/", filterController.createFilter)

  // GET /api/filters/
  // Retrieves all filters
  .get("/", filterController.getAllFilters)

  // GET /api/filters/:id
  // Retrieves a specific filter by its ID
  .get("/:id", filterController.getFilterById)

  // PUT /api/filters/:id
  // Updates a specific filter by its ID
  .put("/:id", filterController.updateFilter)

  // DELETE /api/filters/:id
  // Deletes a specific filter by its ID
  .delete("/:id", filterController.deleteFilter);

// Export the router for use in the main Express app
module.exports = router;