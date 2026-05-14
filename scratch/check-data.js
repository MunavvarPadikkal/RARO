require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/productSchema');
const Banner = require('../models/bannerSchema');

const checkData = async () => {
    try {
        await connectDB();
        const product = await Product.findOne();
        const banner = await Banner.findOne();
        console.log('Sample Product Image:', product ? product.productImage[0] : 'No product');
        console.log('Sample Banner Image:', banner ? banner.imageUrl : 'No banner');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
};

checkData();
