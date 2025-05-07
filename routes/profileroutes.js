// routes/profileRoutes.js
const express = require("express");
const { getProfile, updateProfile,createProfile,getParticipantProfile,toggleProfileVisibility } = require('../controllers/profile');
const multerConfig = require('../configs/multerconfig');
const authMiddleware = require('../Middlewares/authmiddle')

const router = express.Router();

router.post("/addprofile",authMiddleware, multerConfig.single("profileImage"),createProfile)
router.get("/", authMiddleware, getProfile);
router.put("/editprofile", authMiddleware, multerConfig.single("profileImage"), updateProfile);
router.get('/participant/:userId',authMiddleware,getParticipantProfile);
router.put("/toggle-visibility", authMiddleware, toggleProfileVisibility);


module.exports = router;
