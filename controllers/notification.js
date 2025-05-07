const Notification = require('../models/notificationschema');

const GroupNotification = require('../models/groupnoti');


exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id, isRead: false })
      .populate('senderId', 'name email') // Populate sender details
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};



exports.getGroupNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await GroupNotification.find({ user: userId ,isRead:false})
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};


// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true } });
    await GroupNotification.updateMany({ user: req.user.id, isRead: false }, { $set: { isRead: true } });
    
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Error marking notifications as read', error });
  }
};