const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const transporter = require("../configs/nodemailer");
const generateOTP = require("../utils/OTP");
const Message = require("../models/message");
const ChatUserList = require("../models/chatUser");
const checkInternetConnection = require("../utils/checkinternet");

const signup = async (req, res) => {
  const { name, email, password } = req.body;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  // Check if the user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(400)
      .json({ message: "User already exists with this email" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();

  const user = new User({ name, email, password: hashedPassword, otp });

  await user.save();

  // Send OTP email
  await transporter.sendMail({
    to: email,
    subject: "OTP Verification",
    text: `Your OTP is: ${otp}`,
  });

  res.status(200).json({ message: "otp is send to email" });
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (user && user.otp === otp) {
    user.isVerified = true;
    user.otp = null; // Clear OTP

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    res.cookie("jwt", token, { httpOnly: true });
    return res.status(200).json({ message: "User verified", token });
  }

  res.status(400).send("Invalid OTP");
};
const login = async (req, res) => {
  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !user.isVerified) {
    return res.status(401).json({ message: "User not found or not verified" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  user.isLoggedIn = true;
  user.isOnline = true;
  user.token = token;
  user.lastLogin = new Date();
  await user.save();

  res.cookie("jwt", token, { httpOnly: true });
  res.status(200).json({ message: "Logged in successfully", token });
};

// Update Account Settings
const updateAccountSettings = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userId = req.user.id; // Get user ID from token

    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return res
        .status(503)
        .json({ message: "No internet connection. Please try again later." });
    }
  
    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update email
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    // Update password
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();

    res.status(200).json({ message: "Account updated successfully" });
  } catch (error) {
    console.error("Error updating account settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const addChatUser = async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user?.id; // Logged-in user's ID

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  if (!userId) {
    return res
      .status(401)
      .json({ message: "Unauthorized: User ID is required." });
  }

  if (!email || email.trim() === "") {
    return res
      .status(400)
      .json({ message: "Email is required to add a user to the chat list." });
  }

  try {
    // Ensure the user exists in the system
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({
          message: "User does not exist. Please ask them to sign up first.",
        });
    }

    // Check if already added to the chat user list
    const existingChatUser = await ChatUserList.findOne({ email, createdBy: userId });
    if (existingChatUser) {
      return res
        .status(409)
        .json({ message: "User is already in your chat list." });
    }

    // Add to chat user list
    const newChatUser = new ChatUserList({
      userId: existingUser._id,
      name: existingUser.name,
      email: existingUser.email,
      createdBy: userId,
    });

    await newChatUser.save();

    res.status(200).json({ message: "User added to chat list.", chatUser: newChatUser });
  } catch (error) {
    console.error("Error adding user to chat list:", error);
    res.status(500).json({ message: "Error adding user to chat list.", error });
  }
};


const fetchChatUsers = async (req, res) => {
  const userId = req.user.id; // Logged-in user's ID

  try {
    // Fetch chat users with last message details
    const chatUsers = await ChatUserList.find({ createdBy: userId })
      .populate("userId", "name email isOnline") // Populate user details
      .lean();

    // Attach the last message exchanged with each user
    for (const chatUser of chatUsers) {
      if (!chatUser.userId) {
        console.warn(`Chat user reference missing for entry: ${chatUser._id}`);
        continue; // Skip if userId is null
      }

      const lastMessage = await Message.findOne({
        $or: [
          { sender: userId, receiver: chatUser.userId._id },
          { sender: chatUser.userId._id, receiver: userId },
        ],
      })
        .sort({ createdAt: -1 }) // Sort by newest
        .select("text createdAt"); // Only include necessary fields

      chatUser.lastMessage = lastMessage || null; // Handle no messages
    }

    res
      .status(200)
      .json({ message: "Chat users fetched successfully.", chatUsers });
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ message: "Error fetching chat users.", error });
  }
};

// Endpoint to get logged-in users excluding the current user
const getLoggedInUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all users excluding the current user
    const users = await User.find(
      {
        _id: { $ne: currentUserId }, // Exclude current user
        "preferences.showOnlineStatus": true, // Respect user preference for visibility
      },
      "name email lastLogin isOnline googleId _id" // Select required fields
    );

    // Verify tokens and adjust isOnline dynamically
    const updatedUsers = users.map((user) => {
      try {
        // Try to decode token
        jwt.verify(user.token, process.env.JWT_SECRET);
        // If token is valid, keep `isOnline` as is
        return user;
      } catch (error) {
        // If token is expired or invalid, set `isOnline` to false
        // user.isOnline = false;
        return user;
      }
    });

    res.status(200).json(updatedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.params.id; // Get the user ID from request parameters
    const user = await User.findById(userId).select("-password"); // Exclude password field

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ message: "Error fetching user", error });
  }
};

const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, {
      isLoggedIn: false,
      isOnline: false,
      token: null, // Clear token on logout
    });

    res.clearCookie("jwt"); // Clear JWT token
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Logout failed");
  }
};

const getcurrentuser = async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(req.user); // Respond with user data excluding password
  // console.log("Current User Data:", req.user);
};

const blockUser = async (req, res) => {
  const { userIdToBlock } = req.body; // ID of the user to be blocked
  const userId = req.user.id; // ID of the logged-in user


  try {

    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return res
        .status(503)
        .json({ message: "No internet connection. Please try again later." });
    }
  
    if (userId === userIdToBlock) {
      return res.status(400).json({ message: "You can't block yourself." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({ message: "User is already blocked" });
    }

    user.blockedUsers.push(userIdToBlock);
    await user.save();

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Error blocking user" });
  }
};

const unblockUser = async (req, res) => {
  const { userIdToUnblock } = req.body; // ID of the user to be unblocked
  const userId = req.user.id; // ID of the logged-in user

  try {
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return res
        .status(503)
        .json({ message: "No internet connection. Please try again later." });
    }
  
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.blockedUsers.includes(userIdToUnblock)) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== userIdToUnblock
    );
    await user.save();

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ message: "Error unblocking user" });
  }
};

const getBlockedUsers = async (req, res) => {
  const userId = req.user.id; // Logged-in user ID

  try {
    const user = await User.findById(userId).populate(
      "blockedUsers",
      "name email"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ blockedUsers: user.blockedUsers });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    res.status(500).json({ message: "Error fetching blocked users" });
  }
};

const updateFcmToken = async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user.id;

  try {
    await User.findByIdAndUpdate(userId, { fcmToken });
    res.status(200).json({ message: "FCM token updated successfully" });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    res.status(500).json({ message: "Error updating FCM token" });
  }
};

module.exports = {
  signup,
  verifyOTP,
  login,
  logout,
  getLoggedInUsers,
  getcurrentuser,
  getUserById,
  updateFcmToken,
  addChatUser,
  fetchChatUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateAccountSettings,
};
