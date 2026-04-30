const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema(
    {
        orderId: {
            type: String,
            default: () => uuidv4(),
            unique: true,
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Snapshot of ordered products — immutable record even if product is later deleted/edited
        orderedItems: [
            {
                productId: {
                    type: Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                productName: {
                    type: String,
                    required: true,
                },
                productImage: {
                    type: String,
                    default: "",
                },
                size: {
                    type: String,
                    required: true,
                },
                color: {
                    type: String,
                    default: "",
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                price: {
                    type: Number,
                    required: true,
                },
                itemTotal: {
                    type: Number,
                    required: true,
                },
                // Per-item lifecycle status
                itemStatus: {
                    type: String,
                    enum: [
                        "Active",
                        "Cancelled",
                        "Return Requested",
                        "Return Approved",
                        "Return Rejected",
                        "Returned",
                    ],
                    default: "Active",
                },
                cancellationReason: {
                    type: String,
                    default: null,
                },
                returnReason: {
                    type: String,
                    default: null,
                },
            },
        ],

        // Snapshot of the delivery address — immutable even if user later edits/deletes the address
        shippingAddress: {
            addressType: { type: String, default: "Home" },
            name: { type: String, required: true },
            phone: { type: String, required: true },
            landMark: { type: String, default: "" },
            city: { type: String, required: true },
            state: { type: String, required: true },
            pincode: { type: Number, required: true },
        },

        paymentMethod: {
            type: String,
            enum: ["Cash on Delivery", "Razorpay"],
            default: "Cash on Delivery",
            required: true,
        },

        razorpayOrderId: {
            type: String,
            default: null,
        },

        razorpayPaymentId: {
            type: String,
            default: null,
        },

        paymentStatus: {
            type: String,
            enum: ["Pending", "Paid", "Failed"],
            default: "Pending",
        },

        orderStatus: {
            type: String,
            enum: [
                "Placed",
                "Pending",
                "Payment Failed",
                "Shipped",
                "Out for Delivery",
                "Delivered",
                "Cancelled",
                "Return Requested",
                "Return Approved",
                "Return Rejected",
                "Returned",
            ],
            default: "Placed",
            required: true,
        },

        // Order-level cancellation/return reasons
        cancellationReason: {
            type: String,
            default: null,
        },
        returnReason: {
            type: String,
            default: null,
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },

        discount: {
            type: Number,
            default: 0,
            min: 0,
        },

        shippingCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        finalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        couponApplied: {
            type: Boolean,
            default: false,
        },

        couponCode: {
            type: String,
            default: null,
        },
        couponId: {
            type: Schema.Types.ObjectId,
            ref: "Coupon",
            default: null,
        },
        walletAmountUsed: {
            type: Number,
            default: 0,
        },

        // Auto-generated invoice number (INV-100001)
        invoiceNumber: {
            type: String,
            unique: true,
            sparse: true,
        },

        // Timeline of status changes for visual tracking
        statusHistory: [
            {
                status: { type: String, required: true },
                date: { type: Date, default: Date.now },
                note: { type: String, default: "" },
            },
        ],

        createdOn: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;