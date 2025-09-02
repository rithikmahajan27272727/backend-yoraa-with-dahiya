// Load environment variables from a .env file into process.env
require("dotenv").config();

// Import required dependencies
const express = require("express"); // Express framework for building the server
const cors = require("cors"); // Middleware to enable Cross-Origin Resource Sharing

// Import route handlers for different API endpoints
const authRouter = require("./src/routes/AuthRoutes"); // Handles authentication-related routes
const { connectToDB } = require("./src/database/db"); // Database connection function
const itemRouter = require("./src/routes/ItemRoutes"); // Handles item-related routes
const SubCategoryRouter = require("./src/routes/SubCategoryRoutes"); // Handles subcategory routes
const CategoryRouter = require("./src/routes/CategoryRoutes"); // Handles category routes
const wishlistRouter = require("./src/routes/WishlistRoutes"); // Handles wishlist-related routes
const cartRoutes = require("./src/routes/CartRoutes"); // Handles cart-related routes
const userRoutes = require("./src/routes/UserRoutes"); // Handles user-related routes
const addressRoutes = require("./src/routes/AddressRoutes"); // Handles address-related routes
const razorpayRoutes = require("./src/routes/paymentRoutes"); // Handles payment processing with Razorpay
const userProfileRoutes = require("./src/routes/UserProfileRoutes"); // Handles user profile routes
const itemDetailsRoutes = require("./src/routes/ItemDetailsRoutes"); // Handles item details routes
const orderRoutes = require("./src/routes/OrderRoutes"); // Handles order-related routes
const privacyPolicyRoutes = require("./src/routes/PrivacyPolicyRoutes"); // Handles privacy policy routes
const notificationRoutes = require("./src/routes/NotificationRoutes"); // Handles notification routes
const filterRoutes = require("./src/routes/FilterRoutes"); // Handles filter-related routes
const bulkUploadRoutes = require("./src/routes/BulkUploadRoutes"); // Handles filter-related routes
const ReviewRoutes = require("./src/routes/ReviewRoutes");
const PromoCodeRoutes = require("./src/routes/PromoCodeRoutes");

// Initialize the Express application
const app = express();

// Apply middleware
app.use(cors()); // Enable CORS for all routes to allow cross-origin requests
app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data with extended option for complex objects

// Connect to the database (e.g., MongoDB, MySQL) using the connectToDB function
connectToDB();

// Define API routes and mount the corresponding routers
app.use("/api/auth", authRouter); // Authentication routes (e.g., login, signup)
app.use("/api/user", userRoutes); // User management routes (e.g., update user info)
app.use("/api/categories", CategoryRouter); // Category management routes
app.use("/api/subcategories", SubCategoryRouter); // Subcategory management routes
app.use("/api/items", itemRouter); // Item management routes (e.g., products)
app.use("/api/itemDetails", itemDetailsRoutes); // Routes for detailed item information
app.use("/api/wishlist", wishlistRouter); // Wishlist management routes
app.use("/api/cart", cartRoutes); // Shopping cart management routes
app.use("/api/address", addressRoutes); // User address management routes
app.use("/api/razorpay", razorpayRoutes); // Payment processing routes using Razorpay
app.use("/api/userProfile", userProfileRoutes); // User profile management routes
app.use("/api/orders", orderRoutes); // Order management routes
app.use("/api privacyPolicy", privacyPolicyRoutes); // Privacy policy routes
app.use("/api", notificationRoutes); // Notification-related routes (Note: Consider specifying a more specific path like /api/notifications)
app.use("/api/filters", filterRoutes); // Routes for filtering items (e.g., by category, price)
app.use("/api/bulkUpload",bulkUploadRoutes );
app.use('/api/reviews', ReviewRoutes); // Updated to distinct review path
app.use("/api/promoCode", PromoCodeRoutes); // Mount promo code routes


// Start the server and listen on port 8080
app.listen(8080, () => {
    console.log(`Server is running on http://localhost:8080`);
});