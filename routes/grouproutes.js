const express = require('express');
const router = express.Router();
const authenticateJWT = require('../Middlewares/authmiddle');
const groupController = require('../controllers/groupcon');
const Group=require('../models/group')

// Group management routes
router.post('/create', authenticateJWT, groupController.createGroup);
router.post('/add-members', authenticateJWT, groupController.addMembersToGroup);
router.post('/switch-admin', authenticateJWT, groupController.switchAdmin);
router.get('/fetchgroupusers', authenticateJWT, groupController.getUserGroups);
router.delete('/leavegroup/:groupId', authenticateJWT, groupController.leaveGroup);

router.get('/group/:groupId', async (req, res) => {
    try {
      const group = await Group.findById(req.params.groupId).populate('members', 'name email');
      if (!group) return res.status(404).json({ message: 'Group not found' });
  
      res.status(200).json(group);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching group details', error });
    }
  });

module.exports = router;
