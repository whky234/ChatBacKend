const mongoose=require('mongoose');


const profileSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    contactNumber: {
      type: String,
      maxlength: 15,
    },
  
    profileImage: {
      type: String, // store image URL or path
    },
    isHidden:{type:Boolean,default:false}

  }, {
    timestamps: true,
  });
  
  module.exports = mongoose.model("Profile", profileSchema);