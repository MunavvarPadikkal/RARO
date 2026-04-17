const mongoose = require("mongoose");
const {Schema} = mongoose;

const productSchema = new Schema({
    productName:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true,

    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true,
    },
    productOffer:{
        type:Number,
        default:0,
    },
    sizes:[{
        size:{
            type:String,
            enum:["S","M","L"],
            required:true,
        },
        quantity:{
            type:Number,
            default:0,
        }
    }],
    color:{
        type:[String],
        required:true
    },
    productImage:{
        type:[String],
        required:true,
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","Out of stock","Discontinued"],
        required:true,
        default:"Available",
    },
    highlights: {
        type: [String],
        default: []
    },
    additionalInfo: {
        type: String,
        default: ""
    }
},{timestamps:true});


const Product = mongoose.model("Product",productSchema);
module.exports = Product;