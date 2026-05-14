const Banner = require("../../models/bannerSchema");
const cloudinary = require("../../config/cloudinary");

/**
 * Helper to extract Cloudinary public_id from a secure URL
 */
const getPublicIdFromUrl = (url) => {
    if (!url || !url.startsWith('http')) return null;
    try {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;
        const startIndex = parts[uploadIndex + 1].startsWith('v') ? uploadIndex + 2 : uploadIndex + 1;
        const publicIdWithExt = parts.slice(startIndex).join('/');
        return publicIdWithExt.split('.')[0];
    } catch (error) {
        return null;
    }
};

/**
 * GET /admin/banners
 * List all banners (non-deleted) with pagination and search.
 */
const loadBanners = async (req, res) => {
    try {
        const { search = "", status = "", page = 1, limit = 10 } = req.query;
        const filter = { isDeleted: false };

        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        if (status === "active") {
            filter.isActive = true;
        } else if (status === "inactive") {
            filter.isActive = false;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalBanners = await Banner.countDocuments(filter);
        const totalPages = Math.ceil(totalBanners / parseInt(limit));

        const banners = await Banner.find(filter)
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.render("banners", {
            banners,
            currentPage: parseInt(page),
            totalPages,
            search,
            status,
            activeTab: "banners"
        });
    } catch (error) {
        console.error("Error loading banners:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * GET /admin/addBanner
 * Render the page to create a new banner.
 */
const getAddBanner = async (req, res) => {
    try {
        res.render("add-banner", { activeTab: "banners" });
    } catch (error) {
        console.error("Error loading add banner page:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * POST /admin/addBanner
 * Create a new banner with image upload and validation.
 */
const addBanner = async (req, res) => {
    try {
        const {
            title,
            subtitle,
            description,
            buttonText,
            buttonLink,
            priority,
            startDate,
            expiryDate,
            isActive
        } = req.body;

        // Image is required
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Banner image is required." });
        }

        // Title is required
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Banner title is required." });
        }

        // Validate dates if both provided
        if (startDate && expiryDate) {
            if (new Date(expiryDate) <= new Date(startDate)) {
                return res.status(400).json({ success: false, message: "Expiry date must be after start date." });
            }
        }

        const newBanner = new Banner({
            title: title.trim(),
            subtitle: subtitle ? subtitle.trim() : "",
            description: description ? description.trim() : "",
            imageUrl: req.file.path, // Cloudinary secure URL
            buttonText: buttonText ? buttonText.trim() : "Shop Now",
            buttonLink: buttonLink ? buttonLink.trim() : "/shop",
            priority: priority ? parseInt(priority) : 0,
            startDate: startDate || null,
            expiryDate: expiryDate || null,
            isActive: isActive === "true" || isActive === true
        });

        await newBanner.save();
        res.json({ success: true, message: "Banner created successfully." });

    } catch (error) {
        console.error("Error adding banner:", error);
        res.status(500).json({ success: false, message: "Server error while creating banner." });
    }
};

/**
 * GET /admin/editBanner
 * Render the page to edit an existing banner.
 */
const getEditBanner = async (req, res) => {
    try {
        const { id } = req.query;
        const banner = await Banner.findById(id);
        if (!banner) {
            return res.redirect("/admin/banners");
        }
        res.render("edit-banner", { banner, activeTab: "banners" });
    } catch (error) {
        console.error("Error loading edit banner page:", error);
        res.redirect("/admin/pageError");
    }
};

/**
 * POST /admin/editBanner
 * Update an existing banner with optional new image upload.
 */
const editBanner = async (req, res) => {
    try {
        const {
            id,
            title,
            subtitle,
            description,
            buttonText,
            buttonLink,
            priority,
            startDate,
            expiryDate,
            isActive
        } = req.body;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found." });
        }

        // Title is required
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Banner title is required." });
        }

        // Validate dates if both provided
        if (startDate && expiryDate) {
            if (new Date(expiryDate) <= new Date(startDate)) {
                return res.status(400).json({ success: false, message: "Expiry date must be after start date." });
            }
        }

        // Update fields
        banner.title = title.trim();
        banner.subtitle = subtitle ? subtitle.trim() : "";
        banner.description = description ? description.trim() : "";
        banner.buttonText = buttonText ? buttonText.trim() : "Shop Now";
        banner.buttonLink = buttonLink ? buttonLink.trim() : "/shop";
        banner.priority = priority ? parseInt(priority) : 0;
        banner.startDate = startDate || null;
        banner.expiryDate = expiryDate || null;
        banner.isActive = isActive === "true" || isActive === true;

        // Update image if new one uploaded
        if (req.file) {
            // Delete old image from Cloudinary
            const publicId = getPublicIdFromUrl(banner.imageUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
            banner.imageUrl = req.file.path;
        }

        await banner.save();
        res.json({ success: true, message: "Banner updated successfully." });

    } catch (error) {
        console.error("Error editing banner:", error);
        res.status(500).json({ success: false, message: "Server error while updating banner." });
    }
};

/**
 * POST /admin/toggleBannerStatus
 * Toggle a banner's active/inactive state.
 */
const toggleBannerStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found." });
        }

        banner.isActive = !banner.isActive;
        await banner.save();

        res.json({ success: true, message: `Banner ${banner.isActive ? "enabled" : "disabled"} successfully.` });
    } catch (error) {
        console.error("Error toggling banner status:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * POST /admin/deleteBanner
 * Soft delete a banner.
 */
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.body;
        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found." });
        }

        banner.isDeleted = true;
        banner.isActive = false;

        // Delete image from Cloudinary as requested
        const publicId = getPublicIdFromUrl(banner.imageUrl);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }

        await banner.save();

        res.json({ success: true, message: "Banner deleted successfully." });
    } catch (error) {
        console.error("Error deleting banner:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * POST /admin/updateBannerOrder
 * Update priority order for banners (drag-and-drop support).
 */
const updateBannerOrder = async (req, res) => {
    try {
        const { orderedIds } = req.body;
        // orderedIds is an array of banner IDs in their new order
        if (!orderedIds || !Array.isArray(orderedIds)) {
            return res.status(400).json({ success: false, message: "Invalid order data." });
        }

        const updatePromises = orderedIds.map((id, index) => {
            return Banner.findByIdAndUpdate(id, { priority: index });
        });

        await Promise.all(updatePromises);
        res.json({ success: true, message: "Banner order updated." });
    } catch (error) {
        console.error("Error updating banner order:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

module.exports = {
    loadBanners,
    getAddBanner,
    addBanner,
    getEditBanner,
    editBanner,
    toggleBannerStatus,
    deleteBanner,
    updateBannerOrder
};
