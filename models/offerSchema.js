const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        offerType: {
            type: String,
            enum: ["Product", "Category"],
            required: true,
        },
        discountType: {
            type: String,
            enum: ["Percentage", "Fixed"],
            required: true,
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        maxDiscount: {
            type: Number,
            default: null,
            min: 0,
        },
        selectedProducts: [
            {
                type: Schema.Types.ObjectId,
                ref: "Product",
            },
        ],
        selectedCategories: [
            {
                type: Schema.Types.ObjectId,
                ref: "Category",
            },
        ],
        startDate: {
            type: Date,
            required: true,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;
