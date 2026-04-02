const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const bcrypt = require("bcrypt");
const { generateOtp, sendVerificationEmail } = require("../../utils/emailUtils");

const loadProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId : userId});
        return res.render("profile", {
            user: userData, userAddress: addressData ? addressData : { address: [] }
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

const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        return res.render("edit-profile", { user: userData });
    } catch (error) {
        console.error("edit profile page not found", error);
        res.status(500).send("server error");
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

const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId: userId });

        res.render("address", {
            user: userData,
            userAddress: addressData ? addressData : { address: [] }
        });
    } catch (error) {
        console.error("Error loading user addresses", error);
        res.status(500).send("Server Error");
    }
} 

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const newAddress = { addressType, name, city, landMark, state, pincode, phone, altPhone };
        let userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            // First address ever — make it default
            newAddress.isDefault = true;
            userAddress = new Address({ userId: userId, address: [newAddress] });
            await userAddress.save();
        } else {
            // If no existing default, make this one default
            const hasDefault = userAddress.address.some(a => a.isDefault);
            if (!hasDefault) newAddress.isDefault = true;
            userAddress.address.push(newAddress);
            await userAddress.save();
        }

        res.json({ success: true, message: "Address added successfully!" });
    } catch (error) {
        console.error("Error adding address", error);
        res.status(500).json({ success: false, message: "Failed to add address" });
    }
};

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        const exactAddress = userAddress.address.id(addressId);
        if (!exactAddress) {
            return res.status(404).json({ success: false, message: "Address entry not found" });
        }

        exactAddress.addressType = addressType;
        exactAddress.name = name;
        exactAddress.city = city;
        exactAddress.landMark = landMark;
        exactAddress.state = state;
        exactAddress.pincode = pincode;
        exactAddress.phone = phone;
        exactAddress.altPhone = altPhone;

        await userAddress.save();
        res.json({ success: true, message: "Address updated successfully!" });
    } catch (error) {
        console.error("Error editing address", error);
        res.status(500).json({ success: false, message: "Failed to update address" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressId = req.query.id;

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "Address repository not found" });
        }

        const deletedAddr = userAddress.address.id(addressId);
        const wasDefault = deletedAddr && deletedAddr.isDefault;

        userAddress.address.pull({ _id: addressId });

        // If we deleted the default and others remain, promote the first one
        if (wasDefault && userAddress.address.length > 0) {
            userAddress.address[0].isDefault = true;
        }

        await userAddress.save();

        res.json({ success: true, message: "Address deleted successfully!" });
    } catch (error) {
        console.error("Error deleting address", error);
        res.status(500).json({ success: false, message: "Failed to delete address" });
    }
};

const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId } = req.body;

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "No addresses found" });
        }

        // Clear all defaults, then set the chosen one
        userAddress.address.forEach(addr => {
            addr.isDefault = addr._id.toString() === addressId;
        });

        await userAddress.save();
        res.json({ success: true, message: "Default address updated!" });
    } catch (error) {
        console.error("Error setting default address", error);
        res.status(500).json({ success: false, message: "Failed to set default address" });
    }
};

const changeEmailRequest = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { newEmail, currentPassword } = req.body;

        if (!newEmail || !currentPassword) {
            return res.status(400).json({ success: false, message: "New email and current password are required" });
        }

        // Check new email isn't already in use
        const existing = await User.findOne({ email: newEmail });
        if (existing) {
            return res.status(400).json({ success: false, message: "This email is already registered to another account" });
        }

        const user = await User.findById(userId);

        // Verify current password
        if (!user.password) {
            return res.status(400).json({ success: false, message: "Cannot change email — account uses Google login" });
        }
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ success: false, message: "Incorrect current password" });
        }

        // Generate & send OTP to the NEW email
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
        }

        req.session.changeEmailOtp = otp;
        req.session.changeEmailOtpExpire = Date.now() + 60 * 1000;
        req.session.changeEmailNewEmail = newEmail;

        console.log("Change Email OTP sent:", otp);
        return res.json({ success: true, message: "OTP sent to your new email address" });
    } catch (error) {
        console.error("changeEmailRequest error", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const changeEmailVerifyOtp = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { otp } = req.body;

        if (!req.session.changeEmailOtp || !req.session.changeEmailOtpExpire || Date.now() > req.session.changeEmailOtpExpire) {
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        if (otp !== req.session.changeEmailOtp) {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }

        const newEmail = req.session.changeEmailNewEmail;
        await User.findByIdAndUpdate(userId, { email: newEmail });

        // Update session
        req.session.user.email = newEmail;

        // Clear change-email session vars
        req.session.changeEmailOtp = null;
        req.session.changeEmailOtpExpire = null;
        req.session.changeEmailNewEmail = null;

        return res.json({ success: true, message: "Email updated successfully!" });
    } catch (error) {
        console.error("changeEmailVerifyOtp error", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const changeEmailResendOtp = async (req, res) => {
    try {
        const newEmail = req.session.changeEmailNewEmail;
        if (!newEmail) {
            return res.status(400).json({ success: false, message: "Session expired. Please start over." });
        }

        const otp = generateOtp();
        req.session.changeEmailOtp = otp;
        req.session.changeEmailOtpExpire = Date.now() + 60 * 1000;

        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (emailSent) {
            console.log("Change Email OTP resent:", otp);
            return res.json({ success: true, message: "OTP resent successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP" });
        }
    } catch (error) {
        console.error("changeEmailResendOtp error", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


module.exports = {
    loadProfile,
    updateProfilePhoto,
    updateProfile,
    loadEditProfile,
    loadAddress,
    addAddress,
    editAddress,
    deleteAddress,
    setDefaultAddress,
    changeEmailRequest,
    changeEmailVerifyOtp,
    changeEmailResendOtp,
}
