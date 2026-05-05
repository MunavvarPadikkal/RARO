const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralSchema = new Schema(
    {
        referrerUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        referredUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // One referral per referred user
        },
        status: {
            type: String,
            enum: ["pending", "completed"],
            default: "pending",
        },
        rewardReferrer: {
            type: Number,
            default: 100,
        },
        rewardReferred: {
            type: Number,
            default: 50,
        },
        completedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;
