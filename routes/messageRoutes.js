const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticateJWT = require("../Middlewares/authmiddle");
const messageController = require("../controllers/messages");

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./filesharing"); // Save in filesharing folder
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Allowed file types
const allowedTypes = [
  "image/png", "image/jpeg", "image/avif",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip", "application/x-zip-compressed",
  "multipart/x-zip", "application/x-compressed",
  "audio/mpeg", "audio/wav", "audio/ogg", "video/mp4"
];

// File upload configuration
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type!"), false);
    }
  },
});

// Routes
router.get("/messages", authenticateJWT, messageController.getMessages);

router.post(
  "/send-message",
  authenticateJWT,
  upload.array("file", 10), // Allow up to 10 files per request
  messageController.sendMessage
);

router.delete("/deleteforme", authenticateJWT, messageController.deleteforme);

router.delete("/deleteforeveryone", authenticateJWT, messageController.deleteforeveryone);

router.put("/updatemessages", authenticateJWT, messageController.Editmessage);

// // Multer error handling
// router.use((err, req, res, next) => {
//   if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
//     return res.status(400).json({ error: "File size exceeds 10MB limit!" });
//   } else if (err) {
//     return res.status(400).json({ error: err.message });
//   }
//   next();
// });

module.exports = router;
