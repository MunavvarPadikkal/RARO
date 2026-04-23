const Order = require("../models/orderSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Address = require("../models/addressSchema");
const { v4: uuidv4 } = require("uuid");

const getCheckoutData = async (userId) => {
    // 1. Fetch Cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        throw new Error("CART_EMPTY");
    }

    // 2. Fetch User Addresses
    const userAddress = await Address.findOne({ userId });
    const addresses = userAddress ? userAddress.address : [];

    // 3. Prepare Cart Items with flattened product details for the view
    const cartItems = cart.items
        .filter(item => item.productId)
        .map(item => ({
            _id: item._id,
            productId: item.productId._id,
            productName: item.productId.productName,
            productImage: item.productId.productImage[0] || "",
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.productId.salePrice,
            regularPrice: item.productId.regularPrice,
            itemTotal: item.productId.salePrice * item.quantity
        }));

    // 4. Calculate Summary
    const subtotal = cartItems.reduce((acc, item) => acc + item.itemTotal, 0);
    const shippingCharge = 0; 
    const discount = 0; 
    const finalAmount = subtotal + shippingCharge - discount;
    const itemsCount = cartItems.length;

    return {
        cartItems,
        addresses,
        subtotal,
        discount,
        shippingCharge,
        finalAmount,
        itemsCount
    };
};

const placeOrder = async (userId, addressId) => {
    // 1. Fetch Cart & Validate
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty.");
    }

    // 2. Check Stock for all items (variant-specific)
    for (const item of cart.items) {
        if (!item.productId) throw new Error("Some products in your cart are no longer available.");
        
        const variant = item.productId.variants.find(v => v.color === item.color && v.size === item.size);
        if (!variant || variant.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productId.productName} (${item.color}, ${item.size}). Available: ${variant ? variant.stock : 0}`);
        }
    }

    // 3. Find selected address
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) throw new Error("User address record not found.");
    
    const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) throw new Error("Selected address not found.");

    // 4. Prepare Order Items (Snapshots matching Order schema)
    const orderItems = cart.items.map(item => ({
        productId: item.productId._id,
        productName: item.productId.productName,
        productImage: item.productId.productImage[0] || "",
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.productId.salePrice,
        itemTotal: item.productId.salePrice * item.quantity
    }));

    // 5. Calculate totals
    const subtotal = orderItems.reduce((acc, item) => acc + item.itemTotal, 0);
    const finalAmount = subtotal; // No discount/tax for now

    // 6. Create Order document matching schema
    const newOrder = new Order({
        orderId: `ORD-${uuidv4().substring(0, 8).toUpperCase()}`,
        userId: userId,
        orderedItems: orderItems,
        shippingAddress: {
            addressType: selectedAddress.addressType || "Home",
            name: selectedAddress.name,
            phone: selectedAddress.phone,
            landMark: selectedAddress.landMark || "",
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode
        },
        paymentMethod: "Cash on Delivery",
        paymentStatus: 'Pending',
        orderStatus: 'Placed',
        subtotal: subtotal,
        discount: 0,
        shippingCharge: 0,
        finalAmount: finalAmount,
        createdOn: new Date()
    });

    await newOrder.save();

    // 7. Deduct Stock from specific variant
    for (const item of cart.items) {
        await Product.updateOne(
            { _id: item.productId._id, "variants.color": item.color, "variants.size": item.size },
            { $inc: { "variants.$.stock": -item.quantity } }
        );
    }

    // 8. Clear Cart
    await Cart.findOneAndDelete({ userId });

    return newOrder;
};

const getOrderById = async (orderId) => {
    return await Order.findById(orderId).populate("orderedItems.productId");
};

module.exports = {
    getCheckoutData,
    placeOrder,
    getOrderById
};
