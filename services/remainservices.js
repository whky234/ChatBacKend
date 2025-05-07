const cron = require('node-cron');
const Group = require('../models/group');
const moment = require('moment');
const { sendNotification } = require('../utils/norificationservices');

const scheduleTaskReminders = () => {
  cron.schedule('0 * * * *', async () => {  // Runs every hour
    try {
      const now = moment();
      const upcomingTasks = await Group.find({
        'tasks.deadline': { $gt: now.toDate(), $lt: now.add(1, 'day').toDate() } // Tasks due within 24 hours
      }).populate('tasks.assignedTo.userId'); // Populate user details

      upcomingTasks.forEach(group => {
        group.tasks.forEach(task => {
          if (moment(task.deadline).diff(moment(), 'hours') <= 24) {
            task.assignedTo.forEach(async (assignee) => {
              const message = `Reminder: Task "${task.title}" is due soon!`;
              await sendNotification(assignee.userId._id, message);
            });
          }
        });
      });
    } catch (error) {
      console.error('Error scheduling reminders:', error);
    }
  });
};

module.exports = { scheduleTaskReminders };
