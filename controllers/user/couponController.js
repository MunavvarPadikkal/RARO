const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");

/**
 * POST /apply-coupon
 * Validate and apply a coupon to the user's cart.
 */
const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user._id;

        if (!code) {
            return res.status(400).json({ success: false, message: "Coupon code is required." });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isDeleted: false });

        // 1. Check if coupon exists
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid coupon code." });
        }

        // 2. Check if active
        if (!coupon.isActive) {
            return res.status(400).json({ success: false, message: "Coupon is currently inactive." });
        }

        // 3. Check if expired
        const now = new Date();
        if (now < coupon.startDate) {
            return res.status(400).json({ success: false, message: "Coupon offer hasn't started yet." });
        }
        if (now > coupon.expiryDate) {
            return res.status(400).json({ success: false, message: "Coupon has expired." });
        }

        // 4. Check total usage limit
        if (coupon.usageCount >= coupon.totalUsageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached." });
        }

        // 5. Check per user usage limit
        const userUsage = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
        if (userUsage && userUsage.count >= coupon.perUserLimit) {
            return res.status(400).json({ success: false, message: "You have reached the usage limit for this coupon." });
        }

        // 6. Check minimum purchase amount
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        let subtotal = 0;
        cart.items.forEach(item => {
            if (item.productId && !item.productId.isDeleted && !item.productId.isBlocked) {
                const effectivePrice = item.productId.salePrice < item.productId.regularPrice ? item.productId.salePrice : item.productId.regularPrice;
                subtotal += effectivePrice * item.quantity;
            }
        });

        if (subtotal < coupon.minPurchase) {
            return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon.` });
        }

        // Apply coupon to cart
        cart.appliedCoupon = coupon._id;
        await cart.save();

        res.json({ 
            success: true, 
            message: "Coupon applied successfully!",
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxDiscount: coupon.maxDiscount
            }
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Server error while applying coupon." });
    }
};

/**
 * POST /remove-coupon
 * Remove applied coupon from the user's cart.
 */
const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId });
        
        if (!cart) {
            return res.status(400).json({ success: false, message: "Cart not found." });
        }

        cart.appliedCoupon = null;
        await cart.save();

        res.json({ success: true, message: "Coupon removed successfully." });

    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).json({ success: false, message: "Server error while removing coupon." });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon
};
