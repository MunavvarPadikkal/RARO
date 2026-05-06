const mongoose = require("mongoose");
const { Schema } = mongoose;

const bannerSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true,
        default: ""
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    imageUrl: {
        type: String,
        required: true
    },
    buttonText: {
        type: String,
        trim: true,
        default: "Shop Now"
    },
    buttonLink: {
        type: String,
        trim: true,
        default: "/shop"
    },
    priority: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: null
    },
    expiryDate: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });


const Banner = mongoose.model("Banner", bannerSchema);
module.exports = Banner;