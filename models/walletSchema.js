const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        transactions: [
            {
                amount: {
                    type: Number,
                    required: true,
                },
                type: {
                    type: String,
                    enum: ["credit", "debit"],
                    required: true,
                },
                reason: {
                    type: String,
                    required: true,
                },
                orderId: {
                    type: String, // String format for UI display
                    default: null,
                },
                date: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    { timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
