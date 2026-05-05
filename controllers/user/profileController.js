const profileService = require("../../services/profileService");
const bcrypt = require("bcrypt");
const { generateOtp, sendVerificationEmail } = require("../../utils/emailUtils");
const walletService = require("../../services/walletService");
const referralService = require("../../services/referralService");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");

const loadProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await profileService.findUserById(userId);
        const addressData = await profileService.findUserAddress(userId);
        
        // Dashboard stats
        const totalOrders = await Order.countDocuments({ userId: userId });
        const pendingOrders = await Order.countDocuments({ 
            userId: userId, 
            orderStatus: { $in: ["Placed", "Pending", "Shipped", "Out for Delivery"] } 
        });
        const wallet = await walletService.getWallet(userId);
        const walletBalance = wallet ? wallet.balance : 0;
        const totalCoupons = await Coupon.countDocuments({ isActive: true, expiryDate: { $gt: new Date() } });

        return res.render("profile", {
            user: userData, 
            userAddress: addressData ? addressData : { address: [] },
            stats: {
                totalOrders,
                pendingOrders,
                walletBalance,
                totalCoupons
            }
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
        await profileService.updateUserPhoto(userId, imagePath);

        res.json({ success: true, imagePath: imagePath, message: "Profile photo updated successfully" });
    } catch (error) {
        console.error("Error updating profile photo", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await profileService.findUserById(userId);
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
            
            const user = await profileService.findUserById(userId);
            
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

        await profileService.updateUserDetails(userId, updateData);
        
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
        const userData = await profileService.findUserById(userId);
        const addressData = await profileService.findUserAddress(userId);

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

        if (!name || name.trim().length < 3) return res.status(400).json({ success: false, message: "Valid house name is required" });
        if (!phone || !/^[0-9]{10}$/.test(phone)) return res.status(400).json({ success: false, message: "Valid 10-digit phone number is required" });
        if (altPhone && altPhone !== 'N/A' && !/^[0-9]{10}$/.test(altPhone)) return res.status(400).json({ success: false, message: "Valid 10-digit alternate phone number is required if provided" });
        if (!landMark || landMark.trim().length === 0) return res.status(400).json({ success: false, message: "Landmark is required" });
        if (!city || city.trim().length === 0) return res.status(400).json({ success: false, message: "City is required" });
        if (!state || state.trim().length === 0) return res.status(400).json({ success: false, message: "State is required" });
        if (!pincode || !/^[0-9]{6}$/.test(pincode)) return res.status(400).json({ success: false, message: "Valid 6-digit pincode is required" });

        const newAddress = { addressType, name, city, landMark, state, pincode, phone, altPhone };
        let userAddress = await profileService.findUserAddress(userId);

        if (!userAddress) {
            // First address ever — make it default
            newAddress.isDefault = true;
            await profileService.createUserAddress(userId, [newAddress]);
        } else {
            // If no existing default, make this one default
            const hasDefault = userAddress.address.some(a => a.isDefault);
            if (!hasDefault) newAddress.isDefault = true;
            userAddress.address.push(newAddress);
            await profileService.saveUserAddress(userAddress);
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

        if (!name || name.trim().length < 3) return res.status(400).json({ success: false, message: "Valid house name is required" });
        if (!phone || !/^[0-9]{10}$/.test(phone)) return res.status(400).json({ success: false, message: "Valid 10-digit phone number is required" });
        if (altPhone && altPhone !== 'N/A' && !/^[0-9]{10}$/.test(altPhone)) return res.status(400).json({ success: false, message: "Valid 10-digit alternate phone number is required if provided" });
        if (!landMark || landMark.trim().length === 0) return res.status(400).json({ success: false, message: "Landmark is required" });
        if (!city || city.trim().length === 0) return res.status(400).json({ success: false, message: "City is required" });
        if (!state || state.trim().length === 0) return res.status(400).json({ success: false, message: "State is required" });
        if (!pincode || !/^[0-9]{6}$/.test(pincode)) return res.status(400).json({ success: false, message: "Valid 6-digit pincode is required" });

        const userAddress = await profileService.findUserAddress(userId);
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

        await profileService.saveUserAddress(userAddress);
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

        const userAddress = await profileService.findUserAddress(userId);
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

        await profileService.saveUserAddress(userAddress);

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

        const userAddress = await profileService.findUserAddress(userId);
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "No addresses found" });
        }

        // Clear all defaults, then set the chosen one
        userAddress.address.forEach(addr => {
            addr.isDefault = addr._id.toString() === addressId;
        });

        await profileService.saveUserAddress(userAddress);
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
        const existing = await profileService.findUserByEmail(newEmail);
        if (existing) {
            return res.status(400).json({ success: false, message: "This email is already registered to another account" });
        }

        const user = await profileService.findUserById(userId);

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
        await profileService.updateUserDetails(userId, { email: newEmail });

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

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        
        const walletData = await walletService.getPaginatedTransactions(userId, page, limit);

        res.render("wallet", {
            user: req.session.user,
            wallet: walletData,
            currentPage: walletData.currentPage,
            totalPages: walletData.totalPages,
            totalTransactions: walletData.totalTransactions
        });
    } catch (error) {
        console.error("Error loading wallet:", error);
        res.redirect("/profile");
    }
};

const loadReferrals = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await profileService.findUserById(userId);
        const referrals = await referralService.getUserReferrals(userId);
        const stats = await referralService.getUserReferralStats(userId);
        const settings = await referralService.getOrCreateSettings();

        res.render("referrals", {
            user: userData,
            referrals,
            stats,
            settings,
            referralCode: userData.referralCode || "N/A",
        });
    } catch (error) {
        console.error("Error loading referrals page:", error);
        res.redirect("/profile");
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
    loadWallet,
    loadReferrals
};
