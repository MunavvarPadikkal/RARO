const mongoose = require("mongoose");
const { Schema } = mongoose;

const refundSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        itemId: {
            type: Schema.Types.ObjectId, // Specific item in the orderedItems array
            default: null,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        type: {
            type: String,
            enum: ["cancel", "return"],
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Completed", "Rejected", "Not Eligible"],
            default: "Pending",
        },
        reason: {
            type: String,
            default: "",
        },
        eligibleForRefund: {
            type: Boolean,
            default: true,
        },
        processedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const Refund = mongoose.model("Refund", refundSchema);
module.exports = Refund;
