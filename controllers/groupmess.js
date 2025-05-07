const Group = require('../models/group');
const Message = require('../models/message');
const mongoose=require('mongoose')

const Notification = require('../models/groupnoti'); // Import Notification model
const checkInternetConnection = require("../utils/checkinternet");



exports.sendMessageToGroup = async (req, res) => {
  const { groupId, text } = req.body;
  const sender = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res.status(503).json({ message: "No internet connection. Please try again later." });
  }

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ message: "Invalid groupId" });
  }

  try {
    const group = await Group.findById(groupId).populate("members", "_id name");

    if (!group) {
      console.warn(`Group not found for groupId: ${groupId}`);
      return res.status(404).json({ message: "Group not found." });
    }
    

    const isMember = group.members.some((member) => member._id.toString() === sender);
    if (!isMember) {
      return res.status(403).json({ message: "You are no longer a member of this group." });
    }

    const receiversList = group.members
      .filter((member) => member._id.toString() !== sender)
      .map((member) => new mongoose.Types.ObjectId(member._id));

    const messageData = {
      sender,
      group: groupId,
      text,
      receivers: receiversList,
    };

    if (req.file) {
      const fileUrl = `/filesharing/${req.file.filename}`;
      if (req.file.mimetype.startsWith("audio")) {
        messageData.audioUrl = fileUrl;
      } else {
        messageData.fileUrl = fileUrl;
      }
    }

    const message = new Message(messageData);
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email")
      .populate("receivers", "name email");

    const io = req.app.get("io");

    // ✅ Emit the actual group message to group members
    receiversList.forEach((receiverId) => {
      io.to(receiverId.toString()).emit("new_message", populatedMessage);
      console.log(`📤 Sent 'new_message' to ${receiverId.toString()}`);
    });

    // ✅ Save and emit real-time group notifications
    const notifications = receiversList.map(async (receiverId) => {
      const notification = new Notification({
        user: receiverId,
        message: `New message in group ${group.name}`,
        group: groupId,
      });
      await notification.save();

      // ✅ This is the event your frontend is listening to!
      io.to(receiverId.toString()).emit("notification:group", {
        groupId,
        message: `New message in group ${group.name}`,
      });
      console.log(`🔔 Sent 'notification:group' to ${receiverId.toString()}`);
    });

    await Promise.all(notifications);

    res.status(201).json({ message: "Message sent successfully", message: populatedMessage });
  } catch (error) {
    console.error("❌ Error sending group message:", error);
    res.status(500).json({ message: "Error sending message", error });
  }
};







exports.getGroupMessages = async (req, res) => {
  const { groupId } = req.query;
  const userId = req.user.id;
  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

    

  try {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    // Fetch messages where the user is either the sender or part of the receiver list
    const messages = await Message.find({
      group: groupId,
      $or: [{ sender: userId }, { receivers: userId }],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "name email")
      .populate("receivers", "name email")
      .populate("seenBy", "name email");


    

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching group messages:", error);
    res.status(500).json({ message: "Error fetching messages", error });
  }
};


// Mark message as seen
exports.markMessageAsSeen = async (req, res) => {
  const { messageId } = req.body;
  const userId = req.user.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid messageId" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the user is already in the seenBy array
    if (!message.seenBy.includes(userId)) {
      message.seenBy.push(userId);
      message.deliveryStatus = 'seen'; // Update status if needed
      await message.save();
    }

    const populatedMessage = await Message.findById(messageId)
      .populate("sender", "name email")
      .populate("seenBy", "name email");

    const io = req.app.get("io");
    io.to(message.group.toString()).emit("message_seen", populatedMessage);

    res.status(200).json({ message: "Message marked as seen", data: populatedMessage });
  } catch (error) {
    console.error("Error marking message as seen:", error);
    res.status(500).json({ message: "Error marking message as seen", error });
  }
};

// Fetch seen info for a message
exports.getSeenInfo = async (req, res) => {
  const { messageId } = req.query;

  try {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid messageId" });
    }

    const message = await Message.findById(messageId).populate("seenBy", "name email");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({ seenBy: message.seenBy });
  } catch (error) {
    console.error("Error fetching seen info:", error);
    res.status(500).json({ message: "Error fetching seen info", error });
  }
};



// Delete for Me
exports.deleteForMe = async (req, res) => {
 const {messageId}=req.body;
   console.log('messageId',messageId)
   const userId=req.user.id

  
 try{
   const message= await  Message.findById(messageId);
 
   if(!message){
     return res.status(404).json({message:'message not found'});
   }
 
   if (!message.deletedFor.includes(userId)) {
     message.deletedFor.push(userId);
     await message.save();
   }
 
   res.status(200).json({message:'message deleted successfully',deletedMessage:message})
 }catch(err){
 console.error('error deleted message',err);
 return res.status(500).json({message:'error deleting message',err});
 
 }
};

const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds

// Delete for Everyone
exports.deleteForEveryone = async (req, res) => {
  const { messageId } = req.body;
  const userId = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }
  
  console.log('Received messageId:', messageId);
  console.log('Received userId:', userId);

  if (!messageId) {
    return res.status(400).json({ message: 'Message ID is required' });
  }

  try {
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'You can only delete your own message' });
    }

    // Check if the message is within the allowed delete time
    const now = Date.now();
    if (now - message.time.getTime() > TEN_MINUTES) {
      return res.status(403).json({ message: 'You can only delete a message within 10 minutes' });
    }

    // 🔥 Ensure groupId is available before emitting
    const groupId = message.group?.toString();
    const io = req.app.get('io');

    // 🔥 Emit event before deleting the message
    if (groupId) {
      io.to(groupId).emit('group:message:deleted', { messageId });
    }

    // Now delete the message
    await Message.findByIdAndDelete(messageId);

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Error deleting message:', err);
    return res.status(500).json({ message: 'Error deleting message', error: err.message });
  }
};

// Edit Message
exports.editMessage = async (req, res) => {
  const { messageId, text } = req.body;
  const userId = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'You can only edit your own message' });
    }

    // Check if the message is within the allowed edit time
    const now = Date.now();
    if (now - message.time.getTime() > TEN_MINUTES) {
      return res.status(403).json({ message: 'You can only edit a message within 10 minutes' });
    }

    message.text = text;
    message.edited = true;
    await message.save();

    const io = req.app.get('io');
    const groupId = message.group?.toString(); // 🔥 Ensure groupId is available

    // Emit real-time edit event
    if (groupId) {
      io.to(groupId).emit('group:message:updated', { messageId, newText: text });
    }

    res.status(200).json({ message: 'Message edited successfully', updatedMessage: message });
  } catch (err) {
    console.error('Error editing message:', err);
    return res.status(500).json({ message: 'Error editing message', error: err.message });
  }
};

