const mongoose = require('mongoose');

// Define the schema for the Privacy Policy
const privacyPolicySchema = new mongoose.Schema({
  // Array of Q&A entries for the privacy policy
  privacyPolicy: [
    {
      question: { 
        type: String, 
        required: true // Each entry must have a question
      },
      answer: [
        { 
          type: String, 
          required: true // Each answer must be a non-empty string
        }
      ]
    }
  ]
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

// Create the model from the schema
const PrivacyPolicy = mongoose.model('PrivacyPolicy', privacyPolicySchema);

// Export the model to use in other parts of the application
module.exports = PrivacyPolicy;
