const mongoose = require("mongoose");

// =============================================
// Schema: OTP
// Purpose: Store OTPs for phone number verification with expiry
// =============================================
const otpSchema = new mongoose.Schema({
  phNo: {
    type: String,
    required: true,
    // Optional: Add regex validation for phone number format
    // match: [/^\d{10}$/, "Invalid phone number"]
  },
  otp: {
    type: String,
    required: true,
    // Consider hashing the OTP before saving for better security
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// Optional: Add TTL index to auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
