const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // User who will receive the notification
    message: { type: String, required: true }, // Notification text
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false }, // Associated group
    isRead: { type: Boolean, default: false }, // Read status
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GroupNotification', notificationSchema);
