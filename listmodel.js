socket.on("register_user", (userId) => {
    userSockets[userId] = socket.id; // Store user socket ID
    console.log(`[DEBUG] Registered socket ID: ${socket.id} for user: ${userId}`);
  });