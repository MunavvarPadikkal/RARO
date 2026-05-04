const mongoose = require("mongoose");
const {Schema} = mongoose;

const cartSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,                   
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true,
        },
        size:{
            type:String,
            required:true,
        },
        color: {
            type: String,
            required: true,
        },
        quantity:{
            type:Number,
            default:1,
        }, 
        originalPrice: {
            type: Number,
            required: true,
            default: 0,
        },
        offerDiscount: {
            type: Number,
            default: 0,
        },
        price:{
            type:Number,
            required:true,
        },
        totalPrice:{
            type:Number,
            required:true,
        },
        addedAt:{
            type:Date,
            default:Date.now
        }
    }],
    appliedCoupon: {
        type: Schema.Types.ObjectId,
        ref: "Coupon",
        default: null
    }
}, {timestamps: true})

const Cart = mongoose.model("Cart",cartSchema);
module.exports = Cart;