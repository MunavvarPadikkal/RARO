const Coupon = require("../../models/couponSchema");

/**
 * GET /admin/coupons
 * List coupons with pagination, search, and status filtering.
 */
const loadCoupons = async (req, res) => {
    try {
        const { search = "", status = "", page = 1, limit = 10 } = req.query;
        const filter = { isDeleted: false };

        if (search) {
            filter.code = { $regex: search, $options: "i" };
        }

        if (status === "active") {
            filter.isActive = true;
            filter.expiryDate = { $gt: new Date() };
        } else if (status === "expired") {
            filter.expiryDate = { $lte: new Date() };
        } else if (status === "inactive") {
            filter.isActive = false;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalCoupons = await Coupon.countDocuments(filter);
        const totalPages = Math.ceil(totalCoupons / parseInt(limit));

        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.render("coupons", {
            coupons,
            currentPage: parseInt(page),
            totalPages,
            search,
            status,
            activeTab: "coupons"
        });
    } catch (error) {
        console.error("Error loading coupons:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * GET /admin/addCoupon
 * Render the page to create a new coupon.
 */
const getAddCoupon = async (req, res) => {
    try {
        res.render("add-coupon", { activeTab: "coupons" });
    } catch (error) {
        console.error("Error loading add coupon page:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * POST /admin/addCoupon
 * Create a new coupon with validation.
 */
const addCoupon = async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountValue,
            minPurchase,
            maxDiscount,
            startDate,
            expiryDate,
            totalUsageLimit,
            perUserLimit
        } = req.body;

        // 1. Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists." });
        }

        // 2. Validate dates
        if (new Date(expiryDate) <= new Date(startDate)) {
            return res.status(400).json({ success: false, message: "Expiry date must be after start date." });
        }

        // 3. Validate values
        if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({ success: false, message: "Percentage discount must be between 1 and 100." });
        }

        if (discountType === "fixed" && parseFloat(discountValue) >= parseFloat(minPurchase)) {
            return res.status(400).json({ success: false, message: "Discount amount must be less than the minimum purchase amount." });
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discountType,
            discountValue,
            minPurchase,
            maxDiscount: discountType === "percentage" ? maxDiscount : 0,
            startDate,
            expiryDate,
            totalUsageLimit,
            perUserLimit
        });

        await newCoupon.save();
        res.json({ success: true, message: "Coupon created successfully." });

    } catch (error) {
        console.error("Error adding coupon:", error);
        res.status(500).json({ success: false, message: "Server error while creating coupon." });
    }
};

/**
 * GET /admin/editCoupon
 * Render the page to edit an existing coupon.
 */
const getEditCoupon = async (req, res) => {
    try {
        const { id } = req.query;
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.redirect("/admin/coupons");
        }
        res.render("edit-coupon", { coupon, activeTab: "coupons" });
    } catch (error) {
        console.error("Error loading edit coupon page:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * POST /admin/editCoupon
 * Update an existing coupon with validation.
 */
const editCoupon = async (req, res) => {
    try {
        const {
            id,
            code,
            discountType,
            discountValue,
            minPurchase,
            maxDiscount,
            startDate,
            expiryDate,
            totalUsageLimit,
            perUserLimit
        } = req.body;

        // 1. Check if coupon code exists (excluding itself)
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: id } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists." });
        }

        // 2. Validate dates
        if (new Date(expiryDate) <= new Date(startDate)) {
            return res.status(400).json({ success: false, message: "Expiry date must be after start date." });
        }

        // 3. Validate values
        if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({ success: false, message: "Percentage discount must be between 1 and 100." });
        }

        if (discountType === "fixed" && parseFloat(discountValue) >= parseFloat(minPurchase)) {
            return res.status(400).json({ success: false, message: "Discount amount must be less than the minimum purchase amount." });
        }

        await Coupon.findByIdAndUpdate(id, {
            code: code.toUpperCase(),
            discountType,
            discountValue,
            minPurchase,
            maxDiscount: discountType === "percentage" ? maxDiscount : 0,
            startDate,
            expiryDate,
            totalUsageLimit,
            perUserLimit
        });

        res.json({ success: true, message: "Coupon updated successfully." });

    } catch (error) {
        console.error("Error editing coupon:", error);
        res.status(500).json({ success: false, message: "Server error while updating coupon." });
    }
};

/**
 * POST /admin/toggleCouponStatus
 * Enable or disable a coupon.
 */
const toggleStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found." });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.json({ success: true, message: `Coupon ${coupon.isActive ? "enabled" : "disabled"} successfully.` });
    } catch (error) {
        console.error("Error toggling coupon status:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * POST /admin/deleteCoupon
 * Soft delete a coupon.
 */
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.body;
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found." });
        }

        coupon.isDeleted = true;
        await coupon.save();

        res.json({ success: true, message: "Coupon deleted successfully." });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

module.exports = {
    loadCoupons,
    getAddCoupon,
    addCoupon,
    getEditCoupon,
    editCoupon,
    toggleStatus,
    deleteCoupon
};
