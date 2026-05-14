require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/productSchema');
const Banner = require('../models/bannerSchema');
const User = require('../models/userSchema');
const Order = require('../models/orderSchema');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

const uploadToCloudinary = async (filePath, folder) => {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return null;
        }
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
        });
        return result.secure_url;
    } catch (error) {
        console.error(`Error uploading ${filePath}:`, error.message);
        return null;
    }
};

const migrate = async () => {
    try {
        await connectDB();
        console.log('Starting migration...');

        // 1. Migrate Products
        const products = await Product.find({ isDeleted: false });
        console.log(`Found ${products.length} products to check.`);
        for (const product of products) {
            let updated = false;
            const newImages = [];
            for (const img of product.productImage) {
                if (img && !img.startsWith('http')) {
                    console.log(`Migrating product image: ${img}`);
                    const filePath = path.join(UPLOADS_DIR, 'productImages', img);
                    const cloudinaryUrl = await uploadToCloudinary(filePath, 'ecommerce/products');
                    if (cloudinaryUrl) {
                        newImages.push(cloudinaryUrl);
                        updated = true;
                    } else {
                        newImages.push(img); // keep old if failed
                    }
                } else {
                    newImages.push(img);
                }
            }
            if (updated) {
                product.productImage = newImages;
                await product.save();
                console.log(`Updated product: ${product.productName}`);
            }
        }

        // 2. Migrate Banners
        const banners = await Banner.find({ isDeleted: false });
        console.log(`Found ${banners.length} banners to check.`);
        for (const banner of banners) {
            if (banner.imageUrl && !banner.imageUrl.startsWith('http')) {
                console.log(`Migrating banner image: ${banner.imageUrl}`);
                const filePath = path.join(UPLOADS_DIR, 'bannerImages', banner.imageUrl);
                const cloudinaryUrl = await uploadToCloudinary(filePath, 'ecommerce/banners');
                if (cloudinaryUrl) {
                    banner.imageUrl = cloudinaryUrl;
                    await banner.save();
                    console.log(`Updated banner: ${banner.title}`);
                }
            }
        }

        // 3. Migrate User Profiles
        const users = await User.find({ profilePhoto: { $ne: null } });
        console.log(`Found ${users.length} users to check.`);
        for (const user of users) {
            if (user.profilePhoto && !user.profilePhoto.startsWith('http') && !user.profilePhoto.includes('assets/')) {
                // profilePhoto might have /uploads/profileImages/ prefix based on the controller code I saw
                let imgName = user.profilePhoto;
                if (imgName.startsWith('/uploads/profileImages/')) {
                    imgName = imgName.replace('/uploads/profileImages/', '');
                }
                
                console.log(`Migrating user profile: ${imgName}`);
                const filePath = path.join(UPLOADS_DIR, 'profileImages', imgName);
                const cloudinaryUrl = await uploadToCloudinary(filePath, 'ecommerce/profiles');
                if (cloudinaryUrl) {
                    user.profilePhoto = cloudinaryUrl;
                    await user.save();
                    console.log(`Updated user: ${user.email}`);
                }
            }
        }

        // 4. Migrate Orders (Snapshots)
        const orders = await Order.find({});
        console.log(`Found ${orders.length} orders to check.`);
        for (const order of orders) {
            let orderUpdated = false;
            for (const item of order.orderedItems) {
                if (item.productImage && !item.productImage.startsWith('http')) {
                    console.log(`Migrating order item image: ${item.productImage}`);
                    const filePath = path.join(UPLOADS_DIR, 'productImages', item.productImage);
                    const cloudinaryUrl = await uploadToCloudinary(filePath, 'ecommerce/products');
                    if (cloudinaryUrl) {
                        item.productImage = cloudinaryUrl;
                        orderUpdated = true;
                    }
                }
            }
            if (orderUpdated) {
                await order.save();
                console.log(`Updated order snapshots: ${order.orderId}`);
            }
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
    }
};

migrate();
