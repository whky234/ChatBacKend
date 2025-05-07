const Message = require('../models/message');
const User = require('../models/user');
const checkInternetConnection = require("../utils/checkinternet");




// Get messages between two users
exports.getMessages = async (req, res) => {
  const receiver = req.query.receiver || req.query.userId; // Support both 'receiver' and 'userId'
  const sender = req.user.id;
  
  const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return res
        .status(503)
        .json({ message: "No internet connection. Please try again later." });
    }
  

  try {

   

    if (!receiver) {
      return res.status(400).json({ message: 'Receiver ID is required.' });
    }

    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    })
      .sort({ time: 1 })
      .populate('sender', 'name email')
      .populate('receiver', 'name email');

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching one-to-one messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error });
  }
};


exports.sendMessage = async (req, res) => {
  const { receiver, text, messageId } = req.body;
  const sender = req.user.id;
  console.log("Received data:", req.body);

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res.status(503).json({ message: "No internet connection. Please try again later." });
  }

  try {
    if (!receiver && !messageId) {
      return res.status(400).json({ message: "Receiver or message to forward is required." });
    }

    let messageData = { sender, receiver };

    if (messageId) {
      const originalMessage = await Message.findById(messageId);
      if (!originalMessage) return res.status(404).json({ message: "Original message not found." });

      if (![originalMessage.sender.toString(), originalMessage.receiver.toString()].includes(sender)) {
        return res.status(403).json({ message: "You are not authorized to forward this message." });
      }

      messageData.text = originalMessage.text || "";
      if (originalMessage.fileUrl) messageData.fileUrl = originalMessage.fileUrl;
      if (originalMessage.audioUrl) messageData.audioUrl = originalMessage.audioUrl;
    } else {
      if (!text) return res.status(400).json({ message: "Text is required for a new message." });
      messageData.text = text;
    }

    const receiverUser = await User.findById(receiver);
    if (!receiverUser) return res.status(404).json({ message: "Recipient does not exist." });

    const senderUser = await User.findById(sender);
    if (receiverUser.blockedUsers.includes(sender) || senderUser.blockedUsers.includes(receiver)) {
      return res.status(403).json({ message: "You cannot send messages to this user." });
    }

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

   

    res.status(201).json({ message: "Message sent successfully", message });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message", error });
  }
};




exports.deleteforme=async(req,res)=>{
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
}


const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds



exports.deleteforeveryone = async (req, res) => {
  const { messageId } = req.body;
  const userId = req.user.id;

  console.log('Received messageId:', messageId);
  console.log('Received userId:', userId);

  if (!messageId) {
    return res.status(400).json({ message: 'Message ID is required' });
  }

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res.status(503).json({ message: "No internet connection. Please try again later." });
  }

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'You can only delete your own message' });
    }

    const now = Date.now();
    if (now - message.time.getTime() > TEN_MINUTES) {
      return res.status(403).json({ message: 'You can only delete a message within 10 minutes' });
    }

    // Soft-delete: update message content instead of removing
    message.text = '🗑️ Message deleted for everyone';
    message.isDeleted = true; // optional flag if you want to hide edit/delete buttons
    await message.save();

    res.status(200).json({ message: 'Message marked as deleted for everyone' });
  } catch (err) {
    console.error('Error deleting message:', err);
    return res.status(500).json({ message: 'Error deleting message', error: err.message });
  }
};


exports.Editmessage=async(req,res)=>{
  const {messageId}=req.body;
  const { text } = req.body;

  const userId=req.user.id;

  const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return res
        .status(503)
        .json({ message: "No internet connection. Please try again later." });
    }
  
try{
  
  const message=await  Message.findById(messageId);

  if(!message){
    return res.status(404).json({message:'message not found'});
  }

  if(!message.sender.toString()==userId){
    return res.status(403).json({message:'You can only Edit your own messsage'});

  }

  // Check if the message is within the allowed edit time
  const now = Date.now();
  if (now - message.time.getTime() > TEN_MINUTES) {
    return res.status(403).json({ message: 'You can only edit a message within 10 minutes' });
  }
  message.text=text;
  message.edited=true;
  await message.save();

  res.status(200).json({message:'message edit successfully',updateMessage:message})
}catch(err){
console.error('error deleted message',err);
return res.status(500).json({message:'error deleting message',err});

}
}