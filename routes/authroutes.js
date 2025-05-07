const express = require('express');
const passport = require('passport');
const {
  signup,
  verifyOTP,
  login,
  logout,
  getLoggedInUsers,
  getcurrentuser,
  getUserById,
  
  addChatUser,
    fetchChatUsers,
    blockUser,
        unblockUser,
        getBlockedUsers,
        updateAccountSettings,
        updateFcmToken
} = require('../controllers/auth');
const jwt=require('jsonwebtoken')
const router = express.Router();
require('dotenv').config()
// const User = require('../models/user'); // Assuming you've set up this model as above
const {forgotPassword,resetPassword}=require('../controllers/reset')
const User=require('../models/user')


const authenticateJWT=require('../Middlewares/authmiddle')

router.post('/signup', signup);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/Users',authenticateJWT, getLoggedInUsers);
router.put('/account-settings', authenticateJWT, updateAccountSettings);
router.post("/update-fcm-token", authenticateJWT, updateFcmToken);


// Logout route
router.post('/logout',authenticateJWT,logout);
router.get('/user/:id', authenticateJWT, getUserById);



router.post('/add',authenticateJWT, addChatUser);
router.get('/getUser',authenticateJWT, fetchChatUsers);

// Get current logged-in user
router.get('/current-user', authenticateJWT,getcurrentuser);
router.get('/blocked-users', authenticateJWT,getBlockedUsers);
router.post('/block', authenticateJWT,blockUser);
router.post('/unblock', authenticateJWT,unblockUser);





    
// In your backend, handle the status update
// router.post('/update-status', authenticateJWT, async (req, res) => {
//   const { isOnline } = req.body;
//   const userId = req.user.id;  // Ensure this is correctly populated via authentication middleware

//   try {
//     // Validate input
//     if (typeof isOnline !== 'boolean') {
//       return res.status(400).json({ message: 'Invalid value for isOnline' });
//     }

//     // Find the user and update the online status
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     user.isOnline = isOnline;
//     await user.save();

//     return res.status(200).json({ message: 'User status updated successfully' });
//   } catch (error) {
//     console.error('Error updating online status:', error);
//     return res.status(500).json({ message: 'Failed to update online status', error });
//   }


// ?
  


// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google'), async(req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, { isLoggedIn: true,isOnline:true }, { new: true });
    user.lastLogin = new Date();

    await user.save()
  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.cookie('jwt', token, { httpOnly: true });
  res.redirect(`http://localhost:4200/auth/google/success?token=${token}`); 
});






module.exports = router;