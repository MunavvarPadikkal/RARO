const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralSettingsSchema = new Schema(
    {
        isEnabled: {
            type: Boolean,
            default: true,
        },
        referrerReward: {
            type: Number,
            default: 100,
            min: 0,
        },
        referredReward: {
            type: Number,
            default: 50,
            min: 0,
        },
        minOrderAmount: {
            type: Number,
            default: 0, // 0 means no minimum
            min: 0,
        },
    },
    { timestamps: true }
);

const ReferralSettings = mongoose.model("ReferralSettings", referralSettingsSchema);
module.exports = ReferralSettings;
