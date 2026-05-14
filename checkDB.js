const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./models/productSchema');
const Banner = require('./models/bannerSchema');
const User = require('./models/userSchema');

const run = async () => {
    try {
        await connectDB();
        const p = await Product.findOne({isDeleted: false});
        const b = await Banner.findOne({isDeleted: false});
        const u = await User.findOne({profilePhoto: { $ne: null }});
        
        console.log('--- DATABASE CHECK ---');
        console.log('Product Image URL:', p ? p.productImage[0] : 'None');
        console.log('Banner Image URL:', b ? b.imageUrl : 'None');
        console.log('User Profile URL:', u ? u.profilePhoto : 'None');
        
        if (p && p.productImage[0] && !p.productImage[0].startsWith('http')) {
            console.log('\nWARNING: Product images still appear to be local filenames!');
        }
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
