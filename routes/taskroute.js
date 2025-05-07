const express = require('express');
const groupController= require('../controllers/taskman');
const authMiddleware = require('../Middlewares/authmiddle'); // Ensure users are authenticated

const router = express.Router();

const multer = require('multer');
const path = require('path');
const Group = require('../models/group'); // Import the Group model

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tasks/'); // Folder where files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });


// Create a new task in a group
router.post('/tasks', authMiddleware, groupController.createGroupTask);
// Update the status of a task in a group
router.put('/tasks/status',upload.single('file'), authMiddleware, groupController.updateTaskStatus);
// Get all tasks of a specific group
router.get('/tasks', authMiddleware, groupController.getGroupTasks);

router.put('/edittask', authMiddleware, groupController.editGroupTask);
router.delete('/deletetask', authMiddleware, groupController.deleteGroupTask);

router.use('/tasks', express.static(path.join(__dirname, '../tasks')));
// File Upload Endpoint
router.post('/:groupId/tasks/:taskId/upload',authMiddleware, upload.single('file'),groupController.uploadfile)

module.exports = router;
