const referralService = require("../../services/referralService");

/**
 * GET /admin/referrals
 * Render admin referral management page.
 */
const loadReferrals = async (req, res) => {
    try {
        const { search, status, page } = req.query;

        const result = await referralService.getAllReferrals({
            search: search || "",
            status: status || "",
            page: page || 1,
            limit: 10,
        });

        const settings = await referralService.getOrCreateSettings();

        return res.render("adminReferrals", {
            referrals: result.referrals,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalReferrals: result.totalReferrals,
            search: search || "",
            status: status || "",
            settings,
        });
    } catch (error) {
        console.error("Admin loadReferrals error:", error);
        return res.redirect("/admin/dashboard");
    }
};

/**
 * GET /admin/referral-settings
 * Render referral settings page.
 */
const loadSettings = async (req, res) => {
    try {
        const settings = await referralService.getOrCreateSettings();
        return res.render("referralSettings", { settings });
    } catch (error) {
        console.error("Admin loadSettings error:", error);
        return res.redirect("/admin/referrals");
    }
};

/**
 * POST /admin/referral-settings
 * Update referral program settings.
 */
const updateSettings = async (req, res) => {
    try {
        const { isEnabled, referrerReward, referredReward, minOrderAmount } = req.body;

        await referralService.updateSettings({
            isEnabled: isEnabled === "true" || isEnabled === true,
            referrerReward,
            referredReward,
            minOrderAmount,
        });

        return res.json({ success: true, message: "Referral settings updated successfully." });
    } catch (error) {
        console.error("Admin updateSettings error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update settings.",
        });
    }
};

module.exports = {
    loadReferrals,
    loadSettings,
    updateSettings,
};
