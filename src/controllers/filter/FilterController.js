const Filter = require("../../models/Filter");

// ✅ Create a new filter
exports.createFilter = async (req, res) => {
  try {
    // Validate priority fields
    if (!req.body.priority || req.body.priority < 1) {
      return res.status(400).json({ error: "Filter priority must be a positive integer" });
    }
    if (req.body.values) {
      for (const value of req.body.values) {
        if (!value.priority || value.priority < 1) {
          return res.status(400).json({ error: `Value '${value.name}' priority must be a positive integer` });
        }
      }
    }

    // Create a new filter document
    const filter = new Filter(req.body);
    await filter.save();
    res.status(201).json(filter);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ Get all filters
exports.getAllFilters = async (req, res) => {
  console.log("Fetching all filters");
  try {
    // Fetch all filters, sort by priority
    const filters = await Filter.find().sort({ priority: 1 });
    // Sort values by priority within each filter
    filters.forEach((filter) => {
      filter.values.sort((a, b) => a.priority - b.priority);
    });
    console.log("Filters:", filters);
    res.json(filters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get a single filter by ID
exports.getFilterById = async (req, res) => {
  try {
    // Find filter and sort values by priority
    const filter = await Filter.findById(req.params.id);
    if (!filter) return res.status(404).json({ error: "Filter not found" });
    filter.values.sort((a, b) => a.priority - b.priority);
    res.json(filter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update a filter by ID
exports.updateFilter = async (req, res) => {
  try {
    // Validate priority fields
    if (req.body.priority && req.body.priority < 1) {
      return res.status(400).json({ error: "Filter priority must be a positive integer" });
    }
    if (req.body.values) {
      for (const value of req.body.values) {
        if (value.priority && value.priority < 1) {
          return res.status(400).json({ error: `Value '${value.name}' priority must be a positive integer` });
        }
      }
    }

    // Update filter
    const filter = await Filter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!filter) return res.status(404).json({ error: "Filter not found" });
    filter.values.sort((a, b) => a.priority - b.priority);
    res.json(filter);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ Delete a filter by ID
exports.deleteFilter = async (req, res) => {
  try {
    const filter = await Filter.findByIdAndDelete(req.params.id);
    if (!filter) return res.status(404).json({ error: "Filter not found" });
    res.json({ message: "Filter deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};