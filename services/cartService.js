const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Wishlist = require("../models/wishlistSchema");

const getProductPrice = (product) => {
    return product.salePrice < product.regularPrice ? product.salePrice : product.regularPrice;
};

const getCart = async (userId) => {
    const cart = await Cart.findOne({ userId })
        .populate({
            path: 'items.productId',
            populate: { path: 'category' }
        })
        .populate('appliedCoupon');

    if (!cart) return { cart: null, subtotal: 0, itemsCount: 0, discount: 0, finalAmount: 0 };

    let subtotal = 0;
    let itemsCount = 0;
    
    for (let item of cart.items) {
        if (item.productId && !item.productId.isDeleted && !item.productId.isBlocked) {
            const currentPrice = getProductPrice(item.productId);
            subtotal += currentPrice * item.quantity;
            itemsCount += item.quantity;
        }
    }

    let discount = 0;
    if (cart.appliedCoupon) {
        const coupon = cart.appliedCoupon;
        
        // Re-validate coupon in service to ensure it's still valid
        const now = new Date();
        const isValid = !coupon.isDeleted && 
                        coupon.isActive && 
                        now >= coupon.startDate && 
                        now <= coupon.expiryDate && 
                        subtotal >= coupon.minPurchase &&
                        coupon.usageCount < coupon.totalUsageLimit;

        if (isValid) {
            if (coupon.discountType === 'percentage') {
                discount = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
                    discount = coupon.maxDiscount;
                }
            } else {
                discount = coupon.discountValue;
            }
        } else {
            // Auto remove invalid coupon
            cart.appliedCoupon = null;
            await cart.save();
        }
    }

    const finalAmount = subtotal - discount;

    return {
        cart,
        subtotal,
        itemsCount,
        discount,
        finalAmount
    };
};

const addToCart = async (userId, productId, size, color, quantity) => {
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.isDeleted) {
        throw new Error("Product is not available");
    }

    const variant = product.variants.find(v => v.color === color && v.size === size);
    if (!variant) {
        throw new Error("Selected variant is not available for this product");
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
        cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item => 
        item.productId.toString() === productId.toString() && 
        item.size === size &&
        item.color === color
    );
    
    const price = getProductPrice(product);
    const parsedQuantity = parseInt(quantity);

    if (parsedQuantity < 1) {
        throw new Error("Quantity must be at least 1");
    }

    if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
        if (newQuantity > variant.stock) {
             throw new Error(`Cannot add more. Only ${variant.stock} units available in stock.`);
        }
        if (newQuantity > 5) {
             throw new Error("Maximum 5 units allowed per item.");
        }
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = price;
        cart.items[existingItemIndex].totalPrice = newQuantity * price;
    } else {
        if (parsedQuantity > variant.stock) {
             throw new Error(`Cannot add more than ${variant.stock} units.`);
        }
        if (parsedQuantity > 5) {
             throw new Error("Maximum 5 units allowed per item.");
        }
        cart.items.push({
            productId,
            size,
            color,
            quantity: parsedQuantity,
            price: price,
            totalPrice: parsedQuantity * price
        });
    }

    await cart.save();

    // Auto remove from wishlist
    try {
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: productId } } }
        );
    } catch (err) {
        console.error("Failed to remove item from wishlist", err);
    }

    return cart;
};

const updateQuantity = async (userId, productId, size, color, quantity) => {
    const parsedQuantity = parseInt(quantity);
    if (parsedQuantity < 1) {
        throw new Error("Quantity must be at least 1");
    }
    if (parsedQuantity > 5) {
        throw new Error("Maximum 5 units allowed per item");
    }

    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.isDeleted) {
        throw new Error("Product is not available");
    }

    const variant = product.variants.find(v => v.color === color && v.size === size);
    if (!variant) {
         throw new Error("Selected variant is not available for this product");
    }

    if (parsedQuantity > variant.stock) {
        throw new Error(`Only ${variant.stock} units available in stock`);
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) throw new Error("Cart not found");

    const itemIndex = cart.items.findIndex(item => 
        item.productId.toString() === productId.toString() && 
        item.size === size &&
        item.color === color
    );
    if (itemIndex === -1) {
        throw new Error("Product not found in cart");
    }

    const price = getProductPrice(product);
    cart.items[itemIndex].quantity = parsedQuantity;
    cart.items[itemIndex].price = price;
    cart.items[itemIndex].totalPrice = parsedQuantity * price; 

    await cart.save();
    return cart;
};

const removeFromCart = async (userId, productId, size, color) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) throw new Error("Cart not found");

    cart.items = cart.items.filter(item => !(
        item.productId.toString() === productId.toString() && 
        item.size === size &&
        item.color === color
    ));
    
    await cart.save();
    return cart;
};

module.exports = {
    getCart,
    addToCart,
    updateQuantity,
    removeFromCart
};
