const express = require('express');
const getNotification= require('../controllers/notification');
const authMiddleware = require('../Middlewares/authmiddle'); // Ensure users are authenticated

const router = express.Router();


router.get('/getnoti',authMiddleware,getNotification.getNotifications);
router.get('/getGroupNotify',authMiddleware,getNotification.getGroupNotifications);
router.put('/mark-all-read', authMiddleware, getNotification.markAllAsRead);


module.exports = router;
