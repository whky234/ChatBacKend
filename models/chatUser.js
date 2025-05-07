const mongoose = require('mongoose');

const ChatUserListSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: { type: String }, // Email can be duplicated across accounts

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Owner of the chat list
});

// Ensure uniqueness of email per `createdBy`
// ChatUserListSchema.index({ email: 1, createdBy: 1 }, { unique: true });
ChatUserListSchema.index({ email: 1, createdBy: 1 }, { unique: true });
ChatUserListSchema.index({ userId: 1, createdBy: 1 }, { unique: true });



module.exports = mongoose.model('ChatUserList', ChatUserListSchema);
