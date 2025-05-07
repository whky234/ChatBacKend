const Group = require('../models/group');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');


// ✅ Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password (use App Password if using Gmail)
  },
});

// ✅ CREATE GROUP TASK (with Email Notifications)
exports.createGroupTask = async (req, res) => {
  const { groupId, title, description, assignedTo, deadline, createdBy } = req.body;
  console.log('Received task data:', req.body);

  if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(createdBy)) {
    return res.status(400).json({ message: 'Invalid groupId or createdBy' });
  }

  try {
    const group = await Group.findById(groupId).populate('members', 'email name');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ message: 'assignedTo must be a non-empty array' });
    }

    if (!assignedTo.every(member => mongoose.Types.ObjectId.isValid(member.userId))) {
      return res.status(400).json({ message: 'Invalid assignedTo userId' });
    }

    if (!assignedTo.every(member => group.members.map(m => m._id.toString()).includes(member.userId.toString()))) {
      return res.status(400).json({ message: 'One or more assigned users are not group members' });
    }

    if (deadline && new Date(deadline) < new Date()) {
      return res.status(400).json({ message: 'Deadline cannot be in the past' });
    }

    const formattedAssignedTo = assignedTo.map(member => ({
      userId: new mongoose.Types.ObjectId(member.userId.toString()),
    }));

    const newTask = {
      title,
      description,
      assignedTo: formattedAssignedTo,
      deadline,
      createdBy: new mongoose.Types.ObjectId(createdBy.toString()),
    };

    group.tasks.push(newTask);
    await group.save();

    // ✅ Send Email Notification
    const assignedUserEmails = group.members
      .filter(member => assignedTo.some(a => a.userId.toString() === member._id.toString()))
      .map(member => member.email);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: assignedUserEmails,
      subject: `New Task Assigned: ${title}`,
      text: `${group.name}You have been assigned a new task.\n\nTitle: ${title}\nDescription: ${description}\nDeadline: ${deadline ? new Date(deadline).toLocaleString() : 'No deadline'}\n\nCheck your Task Pulse account for more details.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    res.status(201).json({ message: 'Task created successfully and notification sent', task: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Error creating task', error });
  }
};



exports.updateTaskStatus = async (req, res) => {
  const { groupId, taskId, userId, status } = req.body;
  console.log(req.body)

  // Validate Object IDs
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(taskId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res.status(400).json({ message: 'Invalid groupId, taskId, or userId' });
  }

  try {
    // Find the group and task
    const group = await Group.findById(groupId).populate('tasks.createdBy', 'email name');
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const task = group.tasks.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Check if the task is overdue
    if (task.deadline && new Date(task.deadline) < new Date() && status !== 'completed') {
      return res.status(400).json({ message: 'Task is overdue. Only completion status can be updated.' });
    }

    // Find the assignee (if user is assigned)
    const assignee = task.assignedTo.find(a => a.userId.toString() === userId);

    // 🔹 Only the creator can mark the task as "completed"
    if (status === "completed") {
      if (task.createdBy?._id.toString() !== userId) {
        return res.status(403).json({ message: 'Only the task creator can mark it as completed.' });
      }

     

      // Check if all assignees are in "in-review"
      const allInReview = task.assignedTo.every(a => a.status === 'in-review');

      if (!allInReview) {
        return res.status(400).json({ message: 'All assignees must be in "in-review" before completing the task.' });
      }
       
      
      

     
      // Mark task as completed
      task.status = 'completed';
      task.assignedTo.forEach(a => (a.status = 'completed')); // Mark all assignees as completed

      await group.save();
      req.app.get('io').to(taskId).emit('taskUpdated', { task });
      return res.status(200).json({ message: 'Task completed successfully', task });
    }

    // 🔹 Assignees can only update their own status
    if (!assignee) {
      return res.status(403).json({ message: 'You can only update your own task status.' });
    }

    if (status === 'in-review') {
      assignee.status = 'in-review';
    } else {
      assignee.status = status;
    }

    await group.save();

     // ✅ Check if all assignees are in "in-review" and notify the creator
    const allInReview = task.assignedTo.every(a => a.status === 'in-review');
    if (allInReview && task.createdBy?.email) {
      const taskTitle = task.title || "Unnamed Task";
      const creatorEmail = task.createdBy.email;
      const creatorName = task.createdBy.name || "User";

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: creatorEmail,
        subject: `Task Ready for Review: ${taskTitle}  from Group ${group.name}`,
        text: `Hello ${creatorName},\n\nAll assignees have marked the task "${taskTitle}" as "in-review". Please review the task now.\n\nBest regards,\nTask Manager`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });
    }
    req.app.get('io').to(taskId).emit('taskUpdated', { task });

    res.status(200).json({ message: 'Task status updated successfully', task });
    console.log(task,task.createdBy?.email)
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Error updating task status', error });
  }
};

exports.uploadfile=async(req,res)=>{
  try {
    const { groupId, taskId } = req.params;
    const fileUrl = `http://localhost:3000/tasks/${req.file.filename}`;

    // Find the group that contains the task
    const group = await Group.findOne({ _id: groupId, 'tasks._id': taskId });

    if (!group) {
      return res.status(404).json({ message: "Group or Task not found" });
    }

    // Find the task in the group
    const task = group.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found in the group" });
    }

    // Update the uploadedFile for the assigned user (assuming the uploader is in assignedTo)
    const userId = req.user._id; // Assuming you have user authentication middleware
    const assignedEntry = task.assignedTo.find(a => a.userId.toString() === userId.toString());

    if (assignedEntry) {
      assignedEntry.fileUrl = fileUrl;
    } else {
      return res.status(403).json({ message: "You are not assigned to this task" });
    }

    await group.save(); // Save changes

    res.json({ message: "File uploaded successfully", fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "File upload failed" });
  }
}


// ✅ GET GROUP TASKS
exports.getGroupTasks = async (req, res) => {
  const { groupId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ message: 'Invalid groupId' });
  }

  try {
    const group = await Group.findById(groupId)
      .populate({ 
        path: 'tasks.assignedTo.userId', 
        select: 'name email' 
      })
      .populate({ 
        path: 'tasks.createdBy',   // ✅ Populate createdBy
        select: 'name email'       // ✅ Select required fields
      });

    if (!group) return res.status(404).json({ message: 'Group not found.' });

    res.status(200).json(group.tasks);
  } catch (error) {
    console.error('Error fetching group tasks:', error);
    res.status(500).json({ message: 'Error fetching group tasks', error });
  }
};


// ✅ EDIT GROUP TASK (Only Creator Can Edit)
exports.editGroupTask = async (req, res) => {
  const { groupId, taskId, userId, title, description, deadline, assignedTo } = req.body;
  console.log("Received Edit Task Request:", req.body);

  if (!mongoose.Types.ObjectId.isValid(groupId) || 
      !mongoose.Types.ObjectId.isValid(taskId) || 
      !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid groupId, taskId, or userId' });
  }

  try {
    const group = await Group.findById(groupId).populate('members', 'email _id');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const task = group.tasks.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // ✅ Check if the user is the creator of the task
    if (task.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Only the task creator can edit this task.' });
    }

    // ✅ Check if the deadline is in the future
    if (deadline && new Date(deadline) < new Date()) {
      return res.status(400).json({ message: 'Deadline cannot be in the past.' });
    }

    // ✅ Ensure assignedTo is valid
    if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ message: 'assignedTo must be a non-empty array' });
    }

    if (!assignedTo.every(member => mongoose.Types.ObjectId.isValid(member.userId))) {
      return res.status(400).json({ message: 'Invalid assignedTo userId' });
    }

    if (!assignedTo.every(member => group.members.some(m => m._id.toString() === member.userId.toString()))) {
      return res.status(400).json({ message: 'One or more assigned users are not group members' });
    }

    // ✅ Update task details
    if (title) task.title = title;
    if (description) task.description = description;
    if (deadline) task.deadline = deadline;
    task.assignedTo = assignedTo.map(member => ({
      userId: new mongoose.Types.ObjectId(member.userId.toString()),
    }));

    // ✅ Extract email addresses of assigned users
    const assignedUserEmails = group.members
      .filter(member => assignedTo.some(a => a.userId.toString() === member._id.toString()))
      .map(member => member.email)
      .filter(email => email); // Remove null/undefined emails

    console.log("📩 Emails to notify:", assignedUserEmails);

    // ✅ Check if emails exist before sending
    if (assignedUserEmails.length > 0) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: assignedUserEmails.join(','), // Ensure it's a comma-separated string
        subject: `Task Updated: ${title}`,
        text: `
Hello,

The task assigned to you in "${group.name}" has been updated.

📝 **Task Title**: ${title}
📄 **Description**: ${description || 'No description provided'}
⏳ **Deadline**: ${deadline ? new Date(deadline).toLocaleString() : 'No deadline set'}

Please check your Task Pulse account for more details.

Best Regards,  
Task Pulse Team
        `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('❌ Error sending email:', error);
        } else {
          console.log('📧 Email sent successfully:', info.response);
        }
      });
    } else {
      console.log("⚠️ No valid email recipients found. Skipping email notification.");
    }

    await group.save();
    res.status(200).json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('❌ Error updating task:', error);
    res.status(500).json({ message: 'Error updating task', error });
  }
};


// ✅ DELETE GROUP TASK (Only Creator or Admin Can Delete)
exports.deleteGroupTask = async (req, res) => {
  const { groupId, taskId, userId } = req.body;

  console.log(req.body)

  if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid groupId, taskId, or userId' });
  }

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const task = group.tasks.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // ✅ Check if the user is the creator or an admin
    if (task.createdBy.toString() !== userId ) {
      return res.status(403).json({ message: 'Only the task creator or an admin can delete this task.' });
    }

    // ✅ Remove task
    group.tasks = group.tasks.filter(t => t._id.toString() !== taskId);
    await group.save();

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Error deleting task', error });
  }
};