const express = require('express');
const router = express.Router();
const authenticateJWT = require('../Middlewares/authmiddle');
const multer = require('multer');
const groupMessageController = require('../controllers/groupmess');
const path = require('path');

// Allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/avif',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
'application/zip', // ZIP file
    'application/x-zip-compressed', // Alternative ZIP MIME type
    'multipart/x-zip', // Alternative ZIP MIME type
    'application/x-compressed', // Alternative ZIP MIME type    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/ogg',
    'video/mp4'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// Configure file uploads (All files go to 'filesharing/' folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './filesharing/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB (adjust as needed)
  },
   fileFilter });

// Group message routes
router.post('/send', authenticateJWT, upload.single('file'), groupMessageController.sendMessageToGroup);
router.get('/messages', authenticateJWT, groupMessageController.getGroupMessages);
router.delete('/Deleteforme/', authenticateJWT, groupMessageController.deleteForMe);
router.delete('/Deleteforevery/', authenticateJWT, groupMessageController.deleteForEveryone);
router.put('/EditMessage/', authenticateJWT, groupMessageController.editMessage);
// Route to mark message as seen
router.post("/mark-seen", authenticateJWT, groupMessageController.markMessageAsSeen);

// Route to get seen info for a message
router.get("/seen-info", authenticateJWT, groupMessageController.getSeenInfo);

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

// Serve static files

module.exports = router;
