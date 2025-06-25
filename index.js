const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/user");
const Group = require("./models/group");
const Message = require("./models/message");
require("dotenv").config();
const connectdb = require("./configs/db"); // Database connection
const passport = require("passport");
require("./configs/passport"); // Passport configurationz
const Notification = require("./models/notificationschema");
const Notificationroute = require("./routes/notifyroute");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const GroupNotification = require("./models/groupnoti"); // Import the model
const { scheduleTaskReminders } = require("./services/remainservices");
const { generateZoomMeeting } = require("./services/Zoomservices");

// API routes
const profileRoutes = require("./routes/profileroutes");
const authRoutes = require("./routes/authroutes");
const chatRoutes = require("./routes/messageRoutes");
const groupRoutes = require("./routes/grouproutes");
const groupMessageRoutes = require("./routes/groupchat");
const taskRoutes = require("./routes/taskroute"); // Import task routes
// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const { v4: uuidv4 } = require("uuid");

connectdb();
scheduleTaskReminders();

// Set up express and HTTP server
const app = express();
const server = http.createServer(app); // Create server

// Middleware configurations
app.use(
  cors({
    origin: "http://localhost:4200",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",

    credentials: true,
  })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(
  "/uploads/profile",
  express.static(path.join(__dirname, "uploads/profile"))
);
app.use("/tasks", express.static(path.join(__dirname, "tasks")));
app.use(
  "/filesharing",
  (req, res, next) => {
    console.log(`Static file requested: ${req.originalUrl}`);
    next();
  },
  express.static(path.join(__dirname, "filesharing"))
);

const fs = require("fs");
const group = require("./models/group");

const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  console.error("🚨 ERROR: uploads folder does not exist at:", uploadPath);
} else {
  console.log("✅ uploads folder found at:", uploadPath);
}

app.use("/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/auth/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/group-messages", groupMessageRoutes);
app.use("/api/grouptask", taskRoutes);
app.use("/api", Notificationroute);

// Test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/create-meeting", async (req, res) => {
  try {
    const meeting = await generateZoomMeeting();

    if (!meeting.join_url) {
      return res
        .status(500)
        .json({ success: false, message: "Meeting URL missing in response" });
    }

    console.log("Zoom Meeting Created:", meeting.join_url); // Log before sending response
    res.status(200).json({ success: true, join_url: meeting.join_url }); // Send response once
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat API Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await model.generateContent(message);
    const reply = response.response.text();

    const formatreply = formatResponse(reply);

    res.json({ formatreply });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function formatResponse(text) {
  // Convert '**Title:**' to <h2>
  text = text.replace(/\*\*(.*?)\*\*/g, "<h2>$1</h2>");

  // Convert bullet points (- item) to <ul><li>...</li></ul>
  text = text.replace(/(?:\n|^)- (.*?)(?:\n|$)/g, "<ul><li>$1</li></ul>");

  // Convert new lines to <p> tags for paragraphs
  text = text.replace(/\n{2,}/g, "</p><p>");

  // Convert inline code (`code`) to <code>
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert code blocks (```language ... ```) to <pre><code>
  text = text.replace(/```(.*?)\n([\s\S]*?)\n```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

  // Wrap everything in <p> tags (if not already inside a block-level tag)
  if (
    !text.startsWith("<h2>") &&
    !text.startsWith("<ul>") &&
    !text.startsWith("<pre>")
  ) {
    text = `<p>${text}</p>`;
  }

  return text;
}

// Initialize socket server
let io; // Declare io globally
const ConnectedUser = new Map();
const ConnectedGroupUsers = new Map();
const activeChats = {}; // Store which user is actively chatting with whom
const onlineUsers = new Map(); // Store userId -> socketId
const userSocketMap = new Map();
const rooms = new Map();
const room = new Map();
const users = new Map(); // Maps usernames to socket IDs

const initializeSocketServer = (server) => {
  io = require("socket.io")(server, {
    cors: {
      origin: "http://localhost:4200", // Replace with your frontend URL
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // console.log(`User connected: ${socket.id}`);
    console.log(`someone is joined socket  ${socket.id}`);
    socket.on("joinRoom", (userId) => {
      socket.join(userId);
      console.log(`🔵 User ${userId} joined room: ${userId}`);
    });

    // Handle individual user events
    handleIndividualSockets(socket, io);

    // Handle group events
    handleGroupSockets(socket, io);

    // Handle disconnect
    socket.on("disconnect", async () => {
      // console.log(`User disconnected: ${socket.id}`);
      let userIdToRemove = null;
      onlineUsers.forEach((sockets, userId) => {
        if (sockets.includes(socket.id)) {
          sockets.splice(sockets.indexOf(socket.id), 1);
          if (sockets.length === 0) {
            userIdToRemove = userId;
          }
        }
      });

      if (userIdToRemove) {
        onlineUsers.delete(userIdToRemove);
        console.log(`❌ ${userIdToRemove} is offline`);
        io.emit("user:statuss", { userId: userIdToRemove, isOnline: false });
      }
      handleUserDisconnect(socket);
    });
  });
};

// Handle individual user socket events
async function getSenderName(userId) {
  try {
    const user = await User.findById(userId).select("name");
    return user ? user.name : "Unknown";
  } catch (error) {
    console.error("Error fetching user name:", error);
    return "Unknown";
  }
}

function handleIndividualSockets(socket, io) {
  // Handle user going online
  socket.on("user:online", async (userId) => {
    try {
      ConnectedUser.set(userId, socket.id);
      await User.findByIdAndUpdate(userId, { isOnline: true });

      // Fetch unread notifications
      const unreadNotifications = await Notification.find({
        userId,
        isRead: false,
      });
      if (unreadNotifications.length > 0) {
        io.to(socket.id).emit("notifications:unread", unreadNotifications);
        await Notification.updateMany(
          { userId, isRead: false },
          { isRead: true }
        ); // Ensure only unread ones are updated
      }

      // Broadcast online status
      io.emit("user:status", { userId, isOnline: true });
      console.log(`User ${userId} is online`);
    } catch (error) {
      console.error("Error setting user online:", error);
    }
  });

  // Handle user going offline
  socket.on("user:offline", async (userId) => {
    try {
      if (ConnectedUser.has(userId)) {
        ConnectedUser.delete(userId);
        await User.findByIdAndUpdate(userId, { isOnline: false });

        // Broadcast offline status
        io.emit("user:status", { userId, isOnline: false });
        console.log(`User ${userId} is offline`);
      }
    } catch (error) {
      console.error("Error setting user offline:", error);
    }
  });

  // When a user comes online
  socket.on("user:onlines", (userId) => {
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, []);
    }
    onlineUsers.get(userId).push(socket.id);

    console.log(
      `✅ ${userId} is online with sockets:`,
      onlineUsers.get(userId)
    );

    io.emit("user:statuss", { userId, isOnline: true });
  });

  // Send the current list of online users
  socket.on("fetch:onlineUsers", () => {
    const usersArray = Array.from(onlineUsers.keys());
    socket.emit("onlineUsers:list", usersArray);
  });

  // Handle manual logout
  socket.on("user:offlines", (userId) => {
    onlineUsers.delete(userId);
    console.log(`🔴 ${userId} logged out`);
    io.emit("user:statuss", { userId, isOnline: false });
  });
  // Handle typing event
  socket.on("typing", ({ toUserId, fromUserId }) => {
    const toSocketId = ConnectedUser.get(toUserId);
    if (toSocketId) {
      io.to(toSocketId).emit("typing", { fromUserId });
    }
  });

  // Handle stop typing event
  socket.on("stopTyping", ({ toUserId, fromUserId }) => {
    const toSocketId = ConnectedUser.get(toUserId);
    if (toSocketId) {
      io.to(toSocketId).emit("stopTyping", { fromUserId });
    }
  });

  socket.on("userActiveInChat", ({ userId, chatWith }) => {
    activeChats[userId] = chatWith;
  });
  // When a user opens a chat, update activeChats
  socket.on("chat:open", ({ userId, chatWithUserId }) => {
    activeChats[userId] = chatWithUserId;
    console.log(
      `[DEBUG] User ${userId} is now viewing chat with ${chatWithUserId}`
    );
  });

  // When a user closes the chat, remove them from activeChats
  socket.on("chat:close", ({ userId }) => {
    delete activeChats[userId];
    console.log(`[DEBUG] User ${userId} closed chat.`);
  });

  socket.on("registerUser", ({ userId }) => {
    userSocketMap[userId] = socket.id;
    console.log(
      `[DEBUG] User ${userId} registered with socket ID: ${socket.id}`
    );
  });
  socket.on("message:send", async (data) => {
    try {
      console.log(`[DEBUG] Received message:send event`, data);

      const { message, toUserId, fromUserId } = data;
      const receiverSocketId = ConnectedUser.get(toUserId);

      const senderName = await getSenderName(fromUserId);
      console.log(
        `[DEBUG] Sender: ${senderName} (${fromUserId}) → Receiver: ${toUserId}`
      );
      console.log(
        `[DEBUG] Receiver Socket ID: ${receiverSocketId || "User Offline"}`
      );

      // Update message status to 'sent'
      let savedMessage = await Message.findByIdAndUpdate(
        message._id,
        { deliveryStatus: "sent" },
        { new: true }
      );
      console.log(`[DEBUG] Message status updated to 'sent':`, savedMessage);

      // Deliver message (online case)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message:receive", {
          message: savedMessage,
          sender: { _id: fromUserId, name: senderName },
          receiver: { _id: toUserId },
        });

        const receiverIsActive = activeChats[toUserId] === fromUserId;

        // // Seen if user is actively chatting
        // if (receiverIsActive) {
        //   savedMessage = await Message.findByIdAndUpdate(
        //     message._id,
        //     { deliveryStatus: "seen" },
        //     { new: true }
        //   );
        //   io.to(ConnectedUser.get(fromUserId)).emit("message:seen", {
        //     messageId: savedMessage._id,
        //     deliveryStatus: "seen",
        //   });
        //   console.log(`[DEBUG] Message ${savedMessage._id} marked as seen`);
        // }

        // ✅ Save notification in DB if user is NOT actively chatting
        if (!receiverIsActive) {
          try {
            const notification = new Notification({
              userId: toUserId,
              senderId: fromUserId,
              message: `New message from ${senderName}`,
              type: "message",
            });
            const savedNotification = await notification.save();
            console.log(
              `[DEBUG] Notification saved in DB for online but inactive user`,
              savedNotification
            );
          } catch (err) {
            console.error(
              `[ERROR] Failed to save notification for inactive user:`,
              err
            );
          }
        }

        // Always send real-time notification
        io.to(receiverSocketId).emit("notification:new", {
          type: "message",
          message: `New message from ${senderName}`,
          fromUserId,
        });
        io.emit("update_notifications");
        console.log(`[DEBUG] Real-time notification sent`);
      } else {
        // 💤 User is offline: Save notification to DB
        try {
          const notification = new Notification({
            userId: toUserId,
            senderId: fromUserId,
            message: `New message from ${senderName}`,
            type: "message",
          });
          const savedNotification = await notification.save();
          console.log(
            `[DEBUG] Notification saved to DB for offline user`,
            savedNotification
          );
        } catch (err) {
          console.error(`[ERROR] Failed to save offline notification:`, err);
        }
      }

      // 🔁 Notify sender
      const senderSocketId = ConnectedUser.get(fromUserId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message:sent", { messageId: message._id });
        console.log(`[DEBUG] Acknowledged sender that message was sent`);
      }
    } catch (error) {
      console.error("[ERROR] Sending message failed:", error);
    }
  });

  socket.on("message:seen", async ({ messageId, fromUserId, toUserId }) => {
    try {
      // 1. Update the message's deliveryStatus in DB
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { deliveryStatus: "seen" },
        { new: true }
      ).populate("sender receiver");

      if (!updatedMessage) {
        console.warn("Message not found for seen:", messageId);
        return;
      }

      // 2. Notify the sender that the message was seen
      io.to(toUserId).emit("message:seen", {
        messageId,
        deliveryStatus: "seen",
        seenBy: fromUserId,
      });

      console.log(`👁️ Message ${messageId} marked as seen`);
    } catch (error) {
      console.error("❌ Error marking message as seen:", error);
    }
  });

  // Handle message delete for everyone
  socket.on("message:delete", async (data) => {
    const { messageId, fromUserId, toUserId } = data;

    try {
      // Check if the message exists
      const existingMessage = await Message.findOne({
        _id: messageId,
        isDeleted: false,
      });

      // Delete the message
      await Message.findByIdAndDelete(messageId, { isDeleted: true });

      console.log(`✅ Message deleted for everyone: ${messageId}`);

      // Notify sender and receiver
      const fromSocketId = ConnectedUser.get(fromUserId);
      const toSocketId = ConnectedUser.get(toUserId);

      if (fromSocketId) {
        io.to(fromSocketId).emit("message:deleted", { messageId });
      }
      if (toSocketId) {
        io.to(toSocketId).emit("message:deleted", { messageId });
      }
    } catch (error) {
      console.error("❌ Error deleting message:", error);
    }
  });

  //Emit for Edit message

  socket.on(
    "message:edit",
    async ({ messageId, newText, toUserId, fromUserId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { text: newText });

        console.log(
          "🔴 Emitting message:edited event to:",
          toUserId,
          fromUserId
        ); // Debugging

        // ✅ Emit the update to both sender & receiver
        io.to(toUserId).emit("message:edited", { messageId, newText });
        io.to(fromUserId).emit("message:edited", { messageId, newText });
        console.log("message is edit", messageId, newText);
      } catch (error) {
        console.error("Error updating message:", error);
      }
    }
  );

  socket.on("user:connected", (userId) => {
    if (userId) {
      ConnectedUser.set(userId, socket.id);
      console.log(`[SOCKET] User ${userId} connected with socket ${socket.id}`);
    }
  });

  socket.on("createRoom", (roomId) => {
    rooms.set(roomId, new Set([socket.id]));
    socket.join(roomId);
    socket.emit("roomCreated", roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("joinRoom", (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.size < 2) {
        // Limit to 2 users per room
        room.add(socket.id);
        socket.join(roomId);
        socket.emit("roomJoined", roomId);

        // Notify the other user in the room about the new participant
        socket.to(roomId).emit("newParticipant");
        console.log(`User ${socket.id} joined room ${roomId}`);
      } else {
        socket.emit("roomFull");
      }
    } else {
      socket.emit("roomNotFound");
    }
  });

  socket.on("offer", (data) => {
    socket.to(data.roomId).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", data.answer);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", data.candidate);
  });
}

// Handle group socket events
function handleGroupSockets(socket, io) {
  // Register user with a username
  socket.on("register-user", (username) => {
    users.set(username, socket.id);
    socket.emit("user-registered", { success: true });
    console.log(`User ${username} registered with ID ${socket.id}`);
  });

  // Create room with random ID
  socket.on("create-room", () => {
    const roomId = uuidv4();
    socket.join(roomId);
    room.set(roomId, { host: socket.id, participants: [socket.id] });

    socket.emit("room-created", { roomId }); // Send back the generated room ID
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  // Join existing room
  socket.on("join-room", (roomId) => {
    const rm = room.get(roomId);
    if (rm) {
      socket.join(roomId);
      rm.participants.push(socket.id);

      socket.to(roomId).emit("user-joined", socket.id);
      socket.emit(
        "room-users",
        rm.participants.filter((id) => id !== socket.id)
      );

      console.log(`User ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit("room-error", "Room not found");
    }
  });

  // Leave room
  socket.on("leave-room", (roomId) => {
    const rm = room.get(roomId);
    if (rm) {
      rm.participants = rm.participants.filter((id) => id !== socket.id);
      socket.leave(roomId);
      socket.to(roomId).emit("user-left", socket.id);
      console.log(`User ${socket.id} left room ${roomId}`);

      // Clean up room if empty
      if (rm.participants.length === 0) {
        room.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
  });

  // End call (host only)
  socket.on("end-call", (roomId) => {
    const rm = room.get(roomId);
    if (rm && rm.host === socket.id) {
      io.to(roomId).emit("call-ended");
      rm.participants.forEach((participantId) => {
        const s = io.sockets.sockets.get(participantId);
        if (s) s.leave(roomId);
      });
      room.delete(roomId);
      console.log(`Call ended and room ${roomId} closed by host ${socket.id}`);
    }
  });

  // WebRTC signaling
  socket.on("offer", ({ targetId, offer }) => {
    io.to(targetId).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ targetId, answer }) => {
    io.to(targetId).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ targetId, candidate }) => {
    io.to(targetId).emit("ice-candidate", { candidate, from: socket.id });
  });

  // Private messaging via socket ID
  socket.on("private-message", ({ to, message }) => {
    io.to(to).emit("private-message", {
      from: socket.id,
      message,
    });
    console.log(`Private message from ${socket.id} to ${to}: ${message}`);
  });

  // Private messaging via username (optional)
  socket.on("private-message-username", ({ username, message }) => {
    const targetId = users.get(username);
    if (targetId) {
      io.to(targetId).emit("private-message", {
        from: socket.id,
        message,
      });
      console.log(
        `Private message from ${socket.id} to ${username} (${targetId}): ${message}`
      );
    } else {
      socket.emit("user-not-found", username);
    }
  });
  
 // Host removes participant
socket.on("remove-participant", ({ roomId, targetId }) => {
  const rm = room.get(roomId);
  if (rm && rm.host === socket.id) {
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.leave(roomId);
      targetSocket.emit("removed-from-room");
      rm.participants = rm.participants.filter(id => id !== targetId);
      socket.to(roomId).emit("user-left", targetId);
      console.log(`Host ${socket.id} removed user ${targetId} from room ${roomId}`);
    }
  }
});


// Host toggles mute/unmute for a participant
socket.on("toggle-mute", ({ roomId, targetId, muted }) => {
  const rm = room.get(roomId);
  if (rm && rm.host === socket.id) {
    io.to(targetId).emit("mute-status", { muted });
    console.log(`Host ${socket.id} set mute=${muted} for ${targetId} in room ${roomId}`);
  }
});

// Host toggles mute/unmute for a participant
socket.on("toggle-camera", ({ roomId, targetId, muted }) => {
  const rm = room.get(roomId);
  if (rm && rm.host === socket.id) {
    io.to(targetId).emit("mute-camera", { muted });
    console.log(`Host ${socket.id} set mute=${muted} for ${targetId} in room ${roomId}`);
  }
});


  socket.on("group:create", async (groupData) => {
    console.log("📡 Received group:create:", groupData); // Check if this prints

    try {
      const newGroup = new Group(groupData);
      // await newGroup.save();

      io.emit("group:created", newGroup);
      console.log("✅ Group created and emitted:", newGroup);
    } catch (error) {
      console.error("❌ Error creating group:", error);
    }
  });

  socket.on("group:addMembers", async ({ groupId, newMembers, adminId }) => {
    console.log(`📡 Event Received: group:addMembers for group ${groupId}`);
    console.log("👥 New Members:", newMembers);
    console.log("👨‍💼 Admin:", adminId);

    try {
      // 🔍 Find the group with current members
      const group = await Group.findById(groupId).populate(
        "members",
        "name _id"
      );

      if (!group) {
        return socket.emit("error", { message: "Group not found." });
      }

      if (group.admin.toString() !== adminId) {
        return socket.emit("error", {
          message: "Only the admin can add members.",
        });
      }

      // ✅ Validate that all new members exist
      const users = await User.find({ _id: { $in: newMembers } }, "name _id");
      if (users.length !== newMembers.length) {
        return socket.emit("error", { message: "Some members do not exist." });
      }

      // ✅ Merge members (avoid duplicates), then convert all to ObjectIds
      const updatedMemberIds = [
        ...new Set([
          ...group.members.map((m) => m._id.toString?.() ?? m.toString()),
          ...newMembers,
        ]),
      ].map((id) => new mongoose.Types.ObjectId(id)); // Important!

      group.members = updatedMemberIds;

      // ✅ Save the updated group
      await group.save();

      // ✅ Repopulate to get updated member names
      const updatedGroup = await Group.findById(groupId).populate(
        "members",
        "name _id"
      );

      // 📩 Notify new members individually
      newMembers.forEach((userId) => {
        io.to(userId).emit("group:member:added", {
          message: `You have been added to the group "${group.name}"`,
          groupId,
          groupDetails: updatedGroup,
        });
      });

      // 📡 Notify all members in the group to update their UI
      io.to(groupId).emit("group:update", {
        groupId,
        updatedMembers: updatedGroup.members, // populated with `name` and `_id`
        groupDetails: updatedGroup,
        admin: updatedGroup.admin.toString(), // optional
      });

      console.log("✅ Members added successfully:", newMembers);
    } catch (error) {
      console.error("❌ Error adding members:", error);
      socket.emit("error", { message: "Error adding members", error });
    }
  });

  socket.on("taskUpdated", ({ taskId, status, groupId }) => {
    console.log(`Task ${taskId} updated to ${status}`);

    // ✅ Broadcast the update to all users in the same group
    io.to(groupId).emit("taskUpdated", { taskId, status, groupId });
  });
  // Join a group
  socket.on("group:join", async ({ groupId, userId }) => {
    if (!ConnectedGroupUsers.has(groupId)) {
      ConnectedGroupUsers.set(groupId, new Set());
    }
    ConnectedGroupUsers.get(groupId).add(userId);

    socket.join(groupId);
    console.log(`User ${userId} joined group ${groupId}`);

    io.to(groupId).emit("group:member:status", { userId, status: "online" });

    try {
      const updatedNotifications = await GroupNotification.updateMany(
        {
          group: new mongoose.Types.ObjectId(groupId), // ✅ Use `group` instead of `groupId`
          user: new mongoose.Types.ObjectId(userId), // ✅ Use `user` instead of `userId`
          isRead: false,
        },
        { $set: { isRead: true } }
      );

      console.log(
        `Updated ${updatedNotifications.modifiedCount} notifications as read for user ${userId} in group ${groupId}`
      );
    } catch (error) {
      console.error(
        `Error marking notifications as read for user ${userId}:`,
        error
      );
    }
  });
  // Leave a group
  socket.on("group:leave", async ({ groupId, userId }) => {
    try {
      console.log(`📡 User ${userId} requested to leave group ${groupId}`);

      // Find the group
      const group = await Group.findById(groupId);
      if (!group) {
        return socket.emit("error", { message: "Group not found." });
      }

      group.members = group.members.filter(
        (member) => member.toString() !== userId
      );

      let newAdmin = null;
      if (group.admin.toString() === userId) {
        newAdmin = group.members.length > 0 ? group.members[0] : null;
        group.admin = newAdmin;
      }

      await group.save();

      // // If the admin leaves, assign a new admin
      //     if (group.admin.toString() === userId) {
      //       if (group.members.length > 0) {
      //         group.admin = group.members[0]; // Assign the first member as the new admin
      //       } else {
      //         // If no members are left, delete the group
      //         await Group.findByIdAndDelete(groupId);
      //         return res.status(200).json({ message: "Group deleted as no members are left." });
      //       }
      //     }

      // 📡 Emit event to all group members
      io.to(groupId).emit("group:member:left", {
        groupId,
        userId,
        remainingMembers: group.members,
        admin: group.admin,
      });

      console.log(
        `✅ User ${userId} left group ${groupId}, notifying members. ${group.members.map(
          (m) => m.toString()
        )} members left. Admin reassigned to: ${group.admin} : 'null'}`
      );
    } catch (error) {
      console.error("❌ Error processing group leave:", error);
      socket.emit("error", { message: "Error leaving group" });
    }
  });

  // Send message to a group
  socket.on("group:message:send", async ({ groupId, userId, message }) => {
    try {
      const senderName = await getSenderName(userId);

      // Save the group message to the database
      const newMessage = new Message({
        group: groupId,
        sender: userId,
        text: message,
      });
      await newMessage.save();
      console.log("socket message", newMessage);

      // Save notification for all group members except sender
      const groupUsers = ConnectedGroupUsers.get(groupId) || new Set();
      for (const member of groupUsers) {
        if (member !== userId) {
          const notification = new GroupNotification({
            userId: member,
            groupId,
            message: `${senderName}: ${message}`,
            isRead: false, // Unread by default
          });
          await notification.save();

          // 🔔 Emit real-time notification to each group member
          for (const member of groupUsers) {
            if (member !== userId) {
              await new GroupNotification({
                userId: member,
                groupId,
                message: `${senderName}: ${message}`,
                isRead: false,
              }).save();

              // ✅ Log before emitting
              console.log(
                `🔔 Emitting group notification to member: ${member}`,
                {
                  groupId,
                  message: `${senderName}: ${message}`,
                }
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending group message:", error);
    }
  });

  socket.on("group:typing", (data) => {
    console.log("Typing event from frontend:", data);

    socket.to(data.groupId).emit("group:typing", data);
  });

  socket.on("group:stopTyping", (data) => {
    console.log("Stop typing event from frontend:", data);

    socket.to(data.groupId).emit("group:stopTyping", data);
  });

  // Edit a group message
  socket.on("group:message:edit", async ({ messageId, userId, newText }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      if (message.sender.toString() !== userId) {
        return;
      }

      message.text = newText;
      message.edited = true;
      await message.save();

      // Emit event to update the message in real-time
      io.to(message.group.toString()).emit("group:message:updated", {
        messageId,
        newText,
      });

      console.log("message updated", messageId, newText);
    } catch (error) {
      console.error("Error editing group message:", error);
    }
  });

  // Delete a group message
  socket.on("group:message:delete", async ({ messageId, userId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      if (message.sender.toString() !== userId) {
        return;
      }

      await Message.findByIdAndDelete(messageId);

      // Emit event to remove the message in real-time
      io.to(message.group.toString()).emit("group:message:deleted", {
        messageId,
      });
    } catch (error) {
      console.error("Error deleting group message:", error);
    }
  });
}

// Handle user disconnect
async function handleUserDisconnect(socket) {
  const userId = Array.from(ConnectedUser.keys()).find(
    (key) => ConnectedUser.get(key) === socket.id
  );

  if (userId) {
    ConnectedUser.delete(userId);

    if (mongoose.Types.ObjectId.isValid(userId)) {
      await User.findByIdAndUpdate(userId, { isOnline: false });

      // Broadcast user offline status to all clients
      socket.broadcast.emit("user:status", { userId, isOnline: false });

      // Remove user from all groups
      for (const [groupId, members] of ConnectedGroupUsers.entries()) {
        if (members.has(userId)) {
          members.delete(userId);
          socket.leave(groupId);
          console.log(`User ${userId} removed from group ${groupId}`);
          socket.broadcast.to(groupId).emit("group:member:status", {
            userId,
            status: "offline",
          });
        }
      }
    } else {
      console.error("Invalid userId:", userId);
    }
  }

  Object.keys(activeChats).forEach((key) => {
    if (activeChats[key] === socket.id) delete activeChats[key];
  });
}

// Start socket server
initializeSocketServer(server);

// Store io in app instance
app.set("io", io);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
