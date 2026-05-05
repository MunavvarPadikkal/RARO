const Referral = require("../models/referralSchema");
const ReferralSettings = require("../models/referralSettingsSchema");
const User = require("../models/userSchema");
const walletService = require("./walletService");

/**
 * Generate a unique referral code from the user's name.
 * Format: RARO_<FIRST4CHARS><RANDOM4DIGITS> (e.g. RARO_MUNU1234)
 */
const generateReferralCode = async (userName) => {
    const prefix = userName
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 4)
        .toUpperCase();

    let code;
    let exists = true;

    // Keep generating until we find a unique code
    while (exists) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        code = `RARO_${prefix}${randomDigits}`;
        const existing = await User.findOne({ referralCode: code });
        exists = !!existing;
    }

    return code;
};

/**
 * Get or create the singleton referral settings document.
 */
const getOrCreateSettings = async () => {
    let settings = await ReferralSettings.findOne();
    if (!settings) {
        settings = await ReferralSettings.create({
            isEnabled: true,
            referrerReward: 100,
            referredReward: 50,
            minOrderAmount: 0,
        });
    }
    return settings;
};

/**
 * Update referral program settings.
 */
const updateSettings = async (data) => {
    const settings = await getOrCreateSettings();
    if (data.isEnabled !== undefined) settings.isEnabled = data.isEnabled;
    if (data.referrerReward !== undefined) settings.referrerReward = Number(data.referrerReward);
    if (data.referredReward !== undefined) settings.referredReward = Number(data.referredReward);
    if (data.minOrderAmount !== undefined) settings.minOrderAmount = Number(data.minOrderAmount);
    await settings.save();
    return settings;
};

/**
 * Create a pending referral record.
 * Validates: referral code exists, prevents self-referral, prevents duplicate.
 */
const createReferral = async (referralCode, referredUserId) => {
    const settings = await getOrCreateSettings();
    if (!settings.isEnabled) {
        return null; // Program disabled, silently skip
    }

    // Find the referrer by their code
    const referrer = await User.findOne({ referralCode: referralCode });
    if (!referrer) {
        throw new Error("Invalid referral code.");
    }

    // Prevent self-referral
    if (referrer._id.toString() === referredUserId.toString()) {
        throw new Error("You cannot use your own referral code.");
    }

    // Check if this user already has a referral (one per user)
    const existingReferral = await Referral.findOne({ referredUserId });
    if (existingReferral) {
        throw new Error("Referral already exists for this user.");
    }

    // Create the referral with reward amounts from current settings
    const referral = await Referral.create({
        referrerUserId: referrer._id,
        referredUserId: referredUserId,
        status: "pending",
        rewardReferrer: settings.referrerReward,
        rewardReferred: settings.referredReward,
    });

    // Link the referred user back to the referrer
    await User.findByIdAndUpdate(referredUserId, { referredBy: referrer._id });

    return referral;
};

/**
 * Process referral reward after a user's first successful (Delivered) order.
 * Called from adminUpdateOrderStatus when status → "Delivered".
 */
const processReferralReward = async (userId, orderFinalAmount) => {
    // Find a pending referral for this user
    const referral = await Referral.findOne({
        referredUserId: userId,
        status: "pending",
    });

    if (!referral) {
        return null; // No pending referral, nothing to do
    }

    const settings = await getOrCreateSettings();
    if (!settings.isEnabled) {
        return null; // Program disabled
    }

    // Check minimum order amount if set
    if (settings.minOrderAmount > 0 && orderFinalAmount < settings.minOrderAmount) {
        return null; // Order doesn't meet minimum
    }

    // Credit referrer wallet
    await walletService.creditWallet(
        referral.referrerUserId,
        referral.rewardReferrer,
        "Referral Reward — Friend completed their first order"
    );

    // Credit referred user wallet
    await walletService.creditWallet(
        referral.referredUserId,
        referral.rewardReferred,
        "Referral Bonus — Welcome reward for your first order"
    );

    // Mark referral as completed
    referral.status = "completed";
    referral.completedAt = new Date();
    await referral.save();

    return referral;
};

/**
 * Get all referrals where the user is the referrer (for user profile page).
 */
const getUserReferrals = async (userId) => {
    return await Referral.find({ referrerUserId: userId })
        .populate("referredUserId", "name email")
        .sort({ createdAt: -1 })
        .lean();
};

/**
 * Get referral stats for a user (the referrer).
 */
const getUserReferralStats = async (userId) => {
    const referrals = await Referral.find({ referrerUserId: userId });
    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter((r) => r.status === "completed").length;
    const pendingReferrals = referrals.filter((r) => r.status === "pending").length;
    const totalEarnings = referrals
        .filter((r) => r.status === "completed")
        .reduce((sum, r) => sum + r.rewardReferrer, 0);

    return { totalReferrals, completedReferrals, pendingReferrals, totalEarnings };
};

/**
 * Admin: Get all referrals with pagination, search, and status filter.
 */
const getAllReferrals = async (query = {}) => {
    const {
        search = "",
        status = "",
        page = 1,
        limit = 10,
    } = query;

    // Build the aggregation pipeline
    const pipeline = [];

    // Lookup referrer
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "referrerUserId",
            foreignField: "_id",
            as: "referrer",
        },
    });
    pipeline.push({ $unwind: "$referrer" });

    // Lookup referred user
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "referredUserId",
            foreignField: "_id",
            as: "referred",
        },
    });
    pipeline.push({ $unwind: "$referred" });

    // Match filters
    const matchStage = {};
    if (status) {
        matchStage.status = status;
    }
    if (search) {
        const searchRegex = new RegExp(search.trim(), "i");
        matchStage.$or = [
            { "referrer.name": searchRegex },
            { "referrer.email": searchRegex },
            { "referred.name": searchRegex },
            { "referred.email": searchRegex },
        ];
    }
    if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
    }

    // Sort by newest first
    pipeline.push({ $sort: { createdAt: -1 } });

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Referral.aggregate(countPipeline);
    const totalReferrals = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalReferrals / limit);

    // Paginate
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Project clean output
    pipeline.push({
        $project: {
            _id: 1,
            status: 1,
            rewardReferrer: 1,
            rewardReferred: 1,
            createdAt: 1,
            completedAt: 1,
            referrerName: "$referrer.name",
            referrerEmail: "$referrer.email",
            referredName: "$referred.name",
            referredEmail: "$referred.email",
        },
    });

    const referrals = await Referral.aggregate(pipeline);

    return {
        referrals,
        currentPage: parseInt(page),
        totalPages,
        totalReferrals,
    };
};

module.exports = {
    generateReferralCode,
    getOrCreateSettings,
    updateSettings,
    createReferral,
    processReferralReward,
    getUserReferrals,
    getUserReferralStats,
    getAllReferrals,
};
