const User = require('../models/user');
const Profile = require('../models/profile');

const SERVER_URL = 'http://localhost:3000'; // Adjust this to your server's URL

// Create new profile for authenticated user
exports.createProfile = async (req, res) => {
    const { bio, description, contactNumber, websiteLinks, isPrivate, isHidden } = req.body;
    const profileImage = req.file ? `${SERVER_URL}/uploads/profile/${req.file.filename}` : null;
  
    try {
        let profile = await Profile.findOne({ userId: req.user.id });
        if (profile) {
            return res.status(400).json({ message: "Profile already exists" });
        }
  
        profile = new Profile({
            userId: req.user.id,
            bio,
            description,
            contactNumber,
            websiteLinks,
            profileImage,
            isPrivate: isPrivate || false, // Default to public
            isHidden: isHidden || false,  // Default to visible
        });
  
        await profile.save();
        res.status(201).json({ message: "Profile created successfully", profile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET current user profile
exports.getProfile = async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.user.id }).populate("userId", "name email");
        if (!profile) return res.status(404).json({ message: "Profile not found" });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// Update profile including privacy and hide settings
exports.updateProfile = async (req, res) => {
    const { bio, description, contactNumber, websiteLinks,isHidden } = req.body;
    const profileImage = req.file ? `${SERVER_URL}/uploads/profile/${req.file.filename}` : null;

    try {
        let profile = await Profile.findOne({ userId: req.user.id });

        if (profile) {
            profile = await Profile.findOneAndUpdate(
                { userId: req.user.id },
                { bio, description, contactNumber, websiteLinks, profileImage, isHidden },
                { new: true }
            );
        } else {
            profile = new Profile({
                userId: req.user.id,
                bio,
                description,
                contactNumber,
                websiteLinks,
                profileImage,
                isHidden: isHidden || false,
            });
            await profile.save();
        }

        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
        console.log(error)
    }
};

// GET a participant's profile by userId with privacy and hide check
exports.getParticipantProfile = async (req, res) => {
    const { userId } = req.params;

    if (!userId || userId.length !== 24) {
        return res.status(400).json({ error: 'Invalid or missing userId' });
    }

    try {
        const profile = await Profile.findOne({ userId }).populate('userId', 'name email');
        
        if (!profile) {
            return res.status(404).json({ message: "Participant's profile not found" });
        }
        
        
        if (profile.isHidden) {
            return res.status(403).json({ message: "This profile is hidden." });
        }
        
        res.json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Hide or unhide profile
exports.toggleProfileVisibility = async (req, res) => {
    try {
        let profile = await Profile.findOne({ userId: req.user.id });
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }
        
        profile.isHidden = !profile.isHidden;
        await profile.save();
        
        res.json({ message: `Profile ${profile.isHidden ? 'hidden' : 'visible'}`, profile });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
