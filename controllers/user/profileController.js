const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const loadProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        return res.render("profile", {
            user: userData
        });
    } catch (error) {
        console.log("profile page not found", error);
        res.status(500).send("server error");
    }
}

const updateProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image provided" });
        }

        const imagePath = `/uploads/profileImages/${req.file.filename}`;
        await User.findByIdAndUpdate(userId, { profilePhoto: imagePath });

        res.json({ success: true, imagePath: imagePath, message: "Profile photo updated successfully" });
    } catch (error) {
        console.error("Error updating profile photo", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { name, phone, currentPassword, newPassword, confirmPassword } = req.body;
        
        const updateData = { name, phone };

        // Handle password update if new password is provided
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ success: false, message: "New passwords do not match" });
            }
            
            const user = await User.findById(userId);
            
            // If user has an existing password (prevents issues for Google Auth users without pass)
            if (user.password) {
                if (!currentPassword) {
                    return res.status(400).json({ success: false, message: "Please provide your current password" });
                }
                const passwordMatch = await bcrypt.compare(currentPassword, user.password);
                if (!passwordMatch) {
                    return res.status(400).json({ success: false, message: "Incorrect current password" });
                }
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            updateData.password = passwordHash;
        }

        await User.findByIdAndUpdate(userId, updateData);
        
        // Update session name if changed
        if (req.session.user) {
            req.session.user.name = name;
        }
        
        res.json({ success: true, message: "Profile updated successfully!" });

    } catch (error) {
        console.error("Error updating profile details", error);
        res.status(500).json({ success: false, message: "Server error occurred while updating profile" });
    }
}


const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        return res.render("profile", {
            user: userData
        });
    } catch (error) {
        console.log("profile page not found", error);
        res.status(500).send("server error");
    }
}

module.exports = {
    loadProfile,
    updateProfilePhoto,
    updateProfile,
    loadEditProfile
}
