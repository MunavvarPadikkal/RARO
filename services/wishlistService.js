const Wishlist = require("../models/wishlistSchema");
const Product = require("../models/productSchema");

const getWishlist = async (userId) => {
    let wishlist = await Wishlist.findOne({ userId }).populate({
        path: 'products.productId',
        populate: { path: 'category' }
    });
    
    if (!wishlist) {
        return { wishlist: null, products: [] };
    }

    // Filter out items where the linked product might have been hard-deleted
    const validProducts = wishlist.products.filter(item => item.productId !== null);
    
    return {
        wishlist,
        products: validProducts
    };
};

const addToWishlist = async (userId, productId) => {
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.isDeleted) {
        throw new Error("Product is unavailable");
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
    }

    const existingProductIndex = wishlist.products.findIndex(item => item.productId.toString() === productId.toString());

    if (existingProductIndex > -1) {
        // Product already exists in wishlist, do nothing or throw logic error if you want to notify user
        return { existing: true, wishlist };
    }

    wishlist.products.push({ productId });
    await wishlist.save();

    return { existing: false, wishlist };
};

const removeFromWishlist = async (userId, productId) => {
    const wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
        throw new Error("Wishlist not found");
    }

    wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId.toString());
    await wishlist.save();
    
    return wishlist;
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
