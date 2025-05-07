const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticateJWT = require("../Middlewares/authmiddle");
const messageController = require("../controllers/messages");

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save all files directly in the "filesharing" folder
    cb(null, "./filesharing");
  },
  filename: (req, file, cb) => {
    // Add a timestamp to the filename to avoid conflicts
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB (adjust as needed)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/avif",
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/zip", // ZIP file
      "application/x-zip-compressed", // Alternative ZIP MIME type
      "multipart/x-zip", // Alternative ZIP MIME type
      "application/x-compressed", // Alternative ZIP MIME type    'audio/mpeg', // .mp3    'audio/mpeg', // .mp3
      "audio/wav",
      "audio/ogg",
      "video/mp4",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type!"), false);
    }
  },
});

// Define routes
router.get("/messages", authenticateJWT, messageController.getMessages);
router.post(
  "/send-message",
  authenticateJWT,
  upload.single("file"),
  messageController.sendMessage
);
router.delete("/deleteforme/", authenticateJWT, messageController.deleteforme);
router.delete(
  "/deleteforeveryone/",
  authenticateJWT,
  messageController.deleteforeveryone
);
router.put("/updatemessages/", authenticateJWT, messageController.Editmessage);
router.get("/messages", authenticateJWT, messageController.getMessages);
router.post(
  "/send-message",
  authenticateJWT,
  upload.single("file"),
  messageController.sendMessage
);

// Handle Multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 10MB limit!" });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});
module.exports = router;
