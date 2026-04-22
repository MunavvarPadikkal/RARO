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

    // 3. Prepare Cart Items (Filter out non-existent products just in case)
    const cartItems = cart.items.filter(item => item.productId);

    // 4. Calculate Summary
    const subtotal = cartItems.reduce((acc, item) => acc + (item.productId.salePrice * item.quantity), 0);
    const shippingCharge = 0; // Flat 0 for now as per RARO tech stack
    const discount = 0; // Coupons logic not yet implemented
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

    // 2. Check Stock for all items
    for (const item of cart.items) {
        if (!item.productId) throw new Error("Some products in your cart are no longer available.");
        if (item.productId.quantity < item.quantity) {
            throw new Error(`Insufficient stock for product: ${item.productId.productName}`);
        }
    }

    // 3. Find selected address
    const userAddress = await Address.findOne({ userId });
    const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) throw new Error("Selected address not found.");

    // 4. Prepare Order Items (Snapshots)
    const orderItems = cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        name: item.productId.productName,
        productImage: item.productId.productImage[0]
    }));

    // 5. Calculate totals
    const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const finalAmount = subtotal; // No discount/tax for now

    // 6. Create Order document
    const newOrder = new Order({
        orderId: `ORD-${uuidv4().substring(0, 8).toUpperCase()}`,
        userId: userId,
        orderedItems: orderItems,
        totalPrice: subtotal,
        discount: 0,
        finalAmount: finalAmount,
        address: selectedAddress,
        status: 'Pending',
        paymentMethod: 'COD', // Defaulting to COD for this stage
        paymentStatus: 'Pending',
        createdOn: new Date()
    });

    await newOrder.save();

    // 7. Deduct Stock
    for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
            $inc: { quantity: -item.quantity }
        });
    }

    // 8. Clear Cart
    await Cart.findOneAndDelete({ userId });

    return newOrder;
};

const getOrderById = async (orderId) => {
    return await Order.findById(orderId).populate("orderedItems.product");
};

module.exports = {
    getCheckoutData,
    placeOrder,
    getOrderById
};
