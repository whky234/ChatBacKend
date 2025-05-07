const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    assignedTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
        status: { type: String, enum: ['pending', 'in-progress','in-review', 'completed'], default: 'pending' },
        fileUrl: String,  // ✅ Store a separate file URL for each assignee

      }
    ],
    status: { type: String, enum: ['pending', 'in-progress','in-review', 'completed'], default: 'pending' },
    deadline: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" }, // Group Description
    image: { type: String, default: "" }, // Group Profile Image URL
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tasks: [taskSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
