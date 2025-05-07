const { sendEmail } = require('./emailservices');
const User = require('../models/user'); // Assuming you have a User model to fetch email

/**
 * Send a notification via Socket.io & Email
 * @param {string} userId - ID of the user
 * @param {string} message - Notification message
 */
const sendNotification = async (userId, message) => {
  // const io = require('../index').io;

  // Real-time notification via Socket.io
  // io.to(userId.toString()).emit('taskReminder', { message });

  // Fetch user email from database
  const user = await User.findById(userId);
  if (user && user.email) {
    await sendEmail(user.email, 'Task Reminder', message);
  }
};

module.exports = { sendNotification };
