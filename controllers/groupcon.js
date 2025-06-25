const Group = require('../models/group');
const User = require('../models/user');
const Message = require('../models/message');
const ChatUserList = require('../models/chatUser');
const checkInternetConnection = require("../utils/checkinternet");


// Create a new group (Admin-only)
exports.createGroup = async (req, res) => {
  const { name, members, description, image } = req.body;
  const admin = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  try {
    if (!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "Group name and at least one member are required.",
      });
    }

    // Validate members
    const users = await User.find({ _id: { $in: members } });
    const userIds = [...new Set(users.map((user) => user._id.toString()))];

    if (userIds.length !== members.length) {
      return res.status(404).json({ message: "Some members do not exist." });
    }

    // Ensure the admin is in the members list
    const uniqueMembers = [...new Set([...userIds, admin])];

    // 💡 Enforce member limit (including admin)
    const MAX_MEMBERS = 10;
    if (uniqueMembers.length > MAX_MEMBERS) {
      return res.status(400).json({
        message: `A group can have a maximum of ${MAX_MEMBERS} members.`,
      });
    }

    // Create the group
    const group = new Group({
      name,
      description: description || "No description provided",
      image: image || "default-group-image.png",
      members: uniqueMembers,
      admin,
    });

    await group.save();
    await group.populate("members", "name email _id");
    await group.populate("admin", "name email _id");


    // Send a message to all members
    uniqueMembers.forEach((memberId) => {
      Message.create({
        groupId: group._id,
        senderId: admin,
        receiverId: memberId,
        text: `You have been added to the group: ${name}`,
      });
    });

    res.status(201).json({
      message: "Group created successfully",
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        image: group.image,
        members: group.members,
        admin: group.admin,
      },
    });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Error creating group", error });
  }
};


// Add members to a group (admin-only functionality)
exports.addMembersToGroup = async (req, res) => {
  const { groupId, newMembers } = req.body; // `newMembers` is an array of user IDs
  const currentUser = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res.status(503).json({
      message: "No internet connection. Please try again later.",
    });
  }

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Only the admin can add members
    if (group.admin.toString() !== currentUser) {
      return res
        .status(403)
        .json({ message: "Only the admin can add members." });
    }

    // Ensure all new members exist
    const users = await User.find({ _id: { $in: newMembers } });
    if (users.length !== newMembers.length) {
      return res.status(404).json({ message: "Some members do not exist." });
    }

    // Combine existing members and new ones (ensure uniqueness)
    const existingMembers = group.members.map((id) => id.toString());
    const updatedMembersSet = new Set([...existingMembers, ...newMembers]);

    // 💡 Enforce member limit
    const MAX_MEMBERS = 10;
    if (updatedMembersSet.size > MAX_MEMBERS) {
      return res.status(400).json({
        message: `Cannot add members. A group can have a maximum of ${MAX_MEMBERS} members.`,
      });
    }

    const io = req.app.get("io"); // get io instance


    // Update the group members
    group.members = [...updatedMembersSet];
    await group.save();
     // 🔔 Emit event to all new members
newMembers.forEach(memberId => {
  io.to(memberId).emit("group-added", group); // Send group data
  console.log(`Group added event emitted to ${memberId}`);
});

    res.status(200).json({ message: "Members added successfully", group });
  } catch (error) {
    console.error("Error adding members:", error);
    res.status(500).json({ message: "Error adding members", error });
  }

 
};


// Switch admin (admin-only functionality)
exports.switchAdmin = async (req, res) => {
  const { groupId, newAdmin } = req.body; // `newAdmin` is the user ID of the new admin
  const currentUser = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Only the current admin can switch admin
    if (group.admin.toString() !== currentUser) {
      return res.status(403).json({ message: 'Only the admin can switch to a new admin.' });
    }

    // Ensure the new admin is a member of the group
    if (!group.members.includes(newAdmin)) {
      return res.status(400).json({ message: 'New admin must be a member of the group.' });
    }

    group.admin = newAdmin;
    await group.save();

    res.status(200).json({ message: 'Admin switched successfully', group });
  } catch (error) {
    console.error('Error switching admin:', error);
    res.status(500).json({ message: 'Error switching admin', error });
  }
};

// Fetch all groups the user belongs to
exports.getUserGroups = async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all groups the user is a part of using `userId` in the members array
    const groups = await Group.find({ members: userId })  // Use userId in members field
      .populate('members', 'name email _id')  // Populate members with name, email, _id
      .populate('admin', 'name email _id')
      .populate({
        path: 'tasks.assignedTo.userId',
        select: 'name email',
    })
    .lean();  // Populate admin with name, email, _id

    // Log the populated groups to the console
    // console.log(JSON.stringify(groups, null, 2));  // Pretty print the groups object

    // Check if there are any groups
    if (groups.length === 0) {
      return res.status(404).json({ message: 'No groups found for this user.' });
    }

    res.status(200).json({
      message: 'Groups fetched successfully',
      groups,
    });

    // Notify user about their group list update via WebSocket
    const io = req.app.get('io');
    io.to(userId).emit('group:list:update', groups);

  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ message: 'Error fetching user groups', error: error.message });
  }
};


exports.leaveGroup = async (req, res) => {
  const { groupId } = req.params; // Get groupId from route params
  const userId = req.user.id;
  console.log(userId,groupId);

   const isConnected = await checkInternetConnection();
      if (!isConnected) {
        return res
          .status(503)
          .json({ message: "No internet connection. Please try again later." });
      }
    

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if the user is a member of the group
    if (!group.members.includes(userId)) {
      return res.status(400).json({ message: "You are not a member of this group." });
    }

    // Remove the user from the group
    group.members = group.members.filter(member => member.toString() !== userId);

    // If the admin leaves, assign a new admin
    if (group.admin.toString() === userId) {
      if (group.members.length > 0) {
        group.admin = group.members[0]; // Assign the first member as the new admin
      } else {
        // If no members are left, delete the group
        await Group.findByIdAndDelete(groupId);
        return res.status(200).json({ message: "Group deleted as no members are left." });
      }
    }

    await group.save();
    
    res.status(200).json({ message: "You have left the group successfully.", group });

    

  } catch (error) {
    console.error("Error leaving group:", error);
    res.status(500).json({ message: "Error leaving group", error });
  }
};

// Remove a member from the group (Admin-only)
exports.removeMemberFromGroup = async (req, res) => {
  const { groupId, memberId } = req.body;
  const currentUser = req.user.id;

  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    return res
      .status(503)
      .json({ message: "No internet connection. Please try again later." });
  }

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Only admin can remove members
    if (group.admin.toString() !== currentUser) {
      return res
        .status(403)
        .json({ message: "Only the admin can remove members." });
    }

    // Prevent admin from removing themselves via this endpoint
    if (memberId === currentUser) {
      return res.status(400).json({
        message: "Admin cannot remove themselves. Use the leave group function.",
      });
    }

    // Check if member is part of the group
    if (!group.members.includes(memberId)) {
      return res.status(404).json({ message: "User is not a member of the group." });
    }

    // Remove the member
    group.members = group.members.filter((id) => id.toString() !== memberId);
    await group.save();

    // Notify removed member via socket
    const io = req.app.get("io");
    io.to(memberId).emit("group:removed", { groupId });

    res.status(200).json({ message: "Member removed successfully", group });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ message: "Error removing member", error });
  }
};
