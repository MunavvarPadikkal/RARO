const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minPurchase: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscount: {
        type: Number,
        default: 0, // Used only for percentage type
        min: 0
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: true
    },
    totalUsageLimit: {
        type: Number,
        required: true,
        min: 1
    },
    perUserLimit: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    usageCount: {
        type: Number,
        default: 0
    },
    usersUsed: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        count: {
            type: Number,
            default: 0
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;