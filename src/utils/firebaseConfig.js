// Import the Firebase Admin SDK
const admin = require("firebase-admin");

// Load the Firebase service account key from a JSON file
// Note: The path is relative to the current file; ensure the file exists at the specified location
const serviceAccount = require("../../serviceAccountKey.json");

// Initialize the Firebase Admin SDK with the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount), // Authenticate using the service account
});

// Export the initialized Firebase Admin instance for use in other modules
module.exports = admin;