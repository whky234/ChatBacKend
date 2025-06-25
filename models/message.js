const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Support multiple receivers

  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },  // Optional for group messages
  text: { type: String, default: null },
  audioUrl: { type: String, default: null },  // Optional for audio messages
fileUrl: { type: [String], default: [] },   // ✅ Supports multiple files
  edited: { type: Boolean, default: false },  // Indicates if the message was edited

  time: { type: Date, default: Date.now },    // Timestamp of the message
  isDeleted: { type: Boolean, default: false },  // Indicates if the message was deleted

  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],  // Users who deleted the message

  // ✅ Message Delivery Status
  deliveryStatus: { 
    type: String, 
    enum: ['sent', 'delivered', 'seen'], 
    default: 'sent' 
  },  

  // ✅ Users who have seen the message
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

// // Validation for either receiver or group
// MessageSchema.pre('validate', function (next) {
//   if (!this.receiver && !this.group) {
//     return next(new Error('Either "receiver" or "group" must be specified.'));
//   }
//   next();
// });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
