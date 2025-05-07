const socketIo = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/user');
const Group = require('./models/group');
const Message = require('./models/message');

const ConnectedUser = new Map();
const ConnectedGroupUsers = new Map();
let io; // Declare io globally



const initializeSocketServer = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: 'http://localhost:4200', // Replace with your frontend URL
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  

 
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle individual user events
    handleIndividualSockets(socket, io);

    // Handle group events
    handleGroupSockets(socket, io);

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      handleUserDisconnect(socket);
    });
  });

  
};

async function getSenderName(userId) {
    try {
      const user = await User.findById(userId).select('name');
      return user ? user.name : 'Unknown';
    } catch (error) {
      console.error('Error fetching user name:', error);
      return 'Unknown';
    }
  }

function handleIndividualSockets(socket, io) {
    // Handle user online
    socket.on('user:online', async (userId) => {
      ConnectedUser.set(userId, socket.id);
      await User.findByIdAndUpdate(userId, { isOnline: true });
      socket.broadcast.emit('user:status', { userId, isOnline: true });
    });
  
    // Handle typing event
    socket.on('typing', ({ toUserId, fromUserId }) => {
      const toSocketId = ConnectedUser.get(toUserId);
      if (toSocketId) {
        io.to(toSocketId).emit('typing', { fromUserId });
      }
    });
  
    // Handle stop typing event
    socket.on('stopTyping', ({ toUserId, fromUserId }) => {
      const toSocketId = ConnectedUser.get(toUserId);
      if (toSocketId) {
        io.to(toSocketId).emit('stopTyping', { fromUserId });
      }
    });
  
    // Handle message send
    socket.on('message:send', async (data) => {
      const { message, toUserId, fromUserId } = data;
      const senderName = await getSenderName(fromUserId);
  
      const toSocketId = ConnectedUser.get(toUserId);
      if (toSocketId) {
        io.to(toSocketId).emit('message:receive', {
          message,
          fromUserId,
          toUserId,
          senderName,
        });
  
        io.to(toSocketId).emit('notification:new', {
          type: 'message',
          message: `New message from ${senderName}`,
          fromUserId,
        });
      } else {
        console.log(`User ${toUserId} is offline. Save the notification.`);
      }
    });
  }
  


  function handleGroupSockets(socket, io) {
    // Join a group
    socket.on('group:join', async ({ groupId, userId }) => {
      if (!ConnectedGroupUsers.has(groupId)) {
        ConnectedGroupUsers.set(groupId, new Set());
      }
      ConnectedGroupUsers.get(groupId).add(userId);
  
      socket.join(groupId);
      console.log(`User ${userId} joined group ${groupId}`);
      io.to(groupId).emit('group:member:status', { userId, status: 'online' });
    });
  
    // Leave a group
    socket.on('group:leave', async ({ groupId, userId }) => {
      if (ConnectedGroupUsers.has(groupId)) {
        ConnectedGroupUsers.get(groupId).delete(userId);
      }
  
      socket.leave(groupId);
      console.log(`User ${userId} left group ${groupId}`);
      io.to(groupId).emit('group:member:status', { userId, status: 'offline' });
    });
  
    // Send message to a group
    socket.on('group:message:send', async ({ groupId, userId, message }) => {
      try {
        const senderName = await getSenderName(userId);
  
        // Save the group message to the database
        const newMessage = new Message({
          group: groupId,
          sender: userId,
          text: message,
        });
        await newMessage.save();
  
        // Emit the message to all group members
        io.to(groupId).emit('group:message:receive', {
          groupId,
          userId,
          message,
          senderName,
        });
      } catch (error) {
        console.error('Error sending group message:', error);
      }
    });
  
    // Handle typing in group
    socket.on('group:typing', ({ groupId, userId }) => {
      io.to(groupId).emit('group:typing', { groupId, userId });
    });
  
    // Handle stop typing in group
    socket.on('group:stopTyping', ({ groupId, userId }) => {
      io.to(groupId).emit('group:stopTyping', { groupId, userId });
    });
  }
  


  async function handleUserDisconnect(socket) {
    const userId = Array.from(ConnectedUser.keys()).find(
      (key) => ConnectedUser.get(key) === socket.id
    );
  
    if (userId) {
      ConnectedUser.delete(userId);
  
      if (mongoose.Types.ObjectId.isValid(userId)) {
        await User.findByIdAndUpdate(userId, { isOnline: false });
  
        // Broadcast user offline status to all clients
        socket.broadcast.emit('user:status', { userId, isOnline: false });
  
        // Remove user from all groups
        for (const [groupId, members] of ConnectedGroupUsers.entries()) {
          if (members.has(userId)) {
            members.delete(userId);
            socket.leave(groupId);
            console.log(`User ${userId} removed from group ${groupId}`);
            socket.broadcast.to(groupId).emit('group:member:status', {
              userId,
              status: 'offline',
            });
          }
        }
      } else {
        console.error('Invalid userId:', userId);
      }
    }
  }

  
  

module.exports = {initializeSocketServer};
