const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    
name: {type:String,require:true},
  email: { type: String, required: true, unique: true },

  password: { type: String, required: false }, // Only used for local signup
  googleId: { type: String, required: false }, // For Google OAuth
  isVerified: { type: Boolean, default: false },
  otp: { type: String, required: false },
  resetPasswordToken: {type:String},
  resetPasswordExpires: {type:Date},
  isLoggedIn: { type: Boolean, default: false },  // New field to track login status
  lastLogin: { type: Date }, 
  isOnline: { type: Boolean, default: false }, // Tracks online/offline status
  preferences: {
    showOnlineStatus: { type: Boolean, default: true }, // User preference for visibility
  },
  token: { type: String, default: null }, // Add token field,
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of blocked user IDs


  


});


userSchema.index({ isOnline: 1 });


module.exports = mongoose.model('User', userSchema);
