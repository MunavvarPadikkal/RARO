const Order = require("../models/orderSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Address = require("../models/addressSchema");
const Counter = require("../models/counterSchema");
const User = require("../models/userSchema");
const { v4: uuidv4 } = require("uuid");

// ─── Allowed status transitions (admin) ──────────────────────────────────────
const ALLOWED_TRANSITIONS = {
    Placed: ["Pending", "Cancelled"],
    Pending: ["Shipped", "Cancelled"],
    Shipped: ["Out for Delivery"],
    "Out for Delivery": ["Delivered"],
    Delivered: [],
    Cancelled: [],
    "Return Requested": ["Returned", "Delivered"],
    "Return Approved": ["Returned", "Delivered"],
    "Return Rejected": ["Delivered"],
    Returned: [],
};

// Statuses that allow user cancellation
const CANCELLABLE_STATUSES = ["Placed", "Pending"];

// ─── Status update helper ────────────────────────────────────────────────────
const _updateTotalOrderStatus = (order) => {
    const items = order.orderedItems;
    const allCancelled = items.every(i => i.itemStatus === "Cancelled");
    const allReturned = items.every(i => i.itemStatus === "Returned");
    const allReturnRequested = items.every(i => i.itemStatus === "Return Requested");

    if (allCancelled) {
        order.orderStatus = "Cancelled";
    } else if (allReturned) {
        order.orderStatus = "Returned";
    } else if (allReturnRequested) {
        order.orderStatus = "Return Requested";
    } else {
        // For mixed statuses or rejections, default to Delivered if already past shipping
        const postDeliveryStatuses = ["Shipped", "Out for Delivery", "Delivered", "Return Requested", "Return Approved", "Return Rejected", "Returned", "Partially Returned", "Partially Cancelled"];
        if (postDeliveryStatuses.includes(order.orderStatus)) {
            order.orderStatus = "Delivered";
        }
    }
};

// ─── Checkout helpers (preserved from original) ──────────────────────────────

const getCheckoutData = async (userId) => {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        throw new Error("CART_EMPTY");
    }

    const userAddress = await Address.findOne({ userId });
    const addresses = userAddress ? userAddress.address : [];

    const cartItems = cart.items
        .filter((item) => item.productId)
        .map((item) => ({
            _id: item._id,
            productId: item.productId._id,
            productName: item.productId.productName,
            productImage: item.productId.productImage[0] || "",
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.productId.salePrice,
            regularPrice: item.productId.regularPrice,
            itemTotal: item.productId.salePrice * item.quantity,
        }));

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
        itemsCount,
    };
};

const placeOrder = async (userId, addressId, paymentMethod = "Cash on Delivery", paymentStatus = null, paymentDetails = null) => {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty.");
    }

    // Check stock for all items (variant-specific)
    for (const item of cart.items) {
        if (!item.productId)
            throw new Error(
                "Some products in your cart are no longer available."
            );

        const variant = item.productId.variants.find(
            (v) => v.color === item.color && v.size === item.size
        );
        if (!variant || variant.stock < item.quantity) {
            throw new Error(
                `Insufficient stock for ${item.productId.productName} (${item.color}, ${item.size}). Available: ${variant ? variant.stock : 0}`
            );
        }
    }

    // Find selected address
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) throw new Error("User address record not found.");

    const selectedAddress = userAddress.address.find(
        (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) throw new Error("Selected address not found.");

    // Prepare order items (snapshots)
    const orderItems = cart.items.map((item) => ({
        productId: item.productId._id,
        productName: item.productId.productName,
        productImage: item.productId.productImage[0] || "",
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.productId.salePrice,
        itemTotal: item.productId.salePrice * item.quantity,
        itemStatus: "Active",
    }));

    // Calculate totals
    const subtotal = orderItems.reduce((acc, item) => acc + item.itemTotal, 0);
    const finalAmount = subtotal;

    // Generate invoice number
    const invoiceSeq = await Counter.getNextSequence("invoiceNumber");
    const invoiceNumber = `INV-${invoiceSeq}`;

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
            pincode: selectedAddress.pincode,
        },
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus ? paymentStatus : (paymentMethod === "Razorpay" ? "Paid" : "Pending"),
        razorpayOrderId: paymentDetails?.razorpayOrderId || null,
        razorpayPaymentId: paymentDetails?.razorpayPaymentId || null,
        orderStatus: paymentStatus === "Failed" ? "Payment Failed" : "Placed",
        subtotal: subtotal,
        discount: 0,
        shippingCharge: 0,
        finalAmount: finalAmount,
        invoiceNumber: invoiceNumber,
        statusHistory: [{ status: paymentStatus === "Failed" ? "Payment Failed" : "Placed", date: new Date(), note: paymentStatus === "Failed" ? "Payment failed during checkout" : "Order placed successfully" }],
        createdOn: new Date(),
    });

    await newOrder.save();

    // Deduct stock only if payment has not failed
    if (paymentStatus !== "Failed") {
        for (const item of cart.items) {
            await Product.updateOne(
                {
                    _id: item.productId._id,
                    variants: { $elemMatch: { color: item.color, size: item.size } }
                },
                { $inc: { "variants.$.stock": -item.quantity } }
            );
        }
    }

    // Clear cart
    await Cart.findOneAndDelete({ userId });

    return newOrder;
};

const getOrderById = async (orderId) => {
    return await Order.findById(orderId).populate("orderedItems.productId");
};

// Check if all items in an order are in stock
const checkStockForOrder = async (order) => {
    for (const item of order.orderedItems) {
        if (!item.productId) throw new Error("Some products are no longer available.");

        // Wait, order.orderedItems.productId is an object if populated, but if not populated we must fetch it.
        // Let's assume order is already populated.
        const product = item.productId;
        const variant = product.variants.find(
            (v) => v.color === item.color && v.size === item.size
        );

        if (!variant || variant.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${product.productName} (${item.color}, ${item.size}). Available: ${variant ? variant.stock : 0}`);
        }
    }
    return true;
};

// Deduct stock for all items in an order
const deductStockForOrder = async (order) => {
    for (const item of order.orderedItems) {
        // item.productId could be populated or just an ID
        const productId = item.productId._id || item.productId;
        await Product.updateOne(
            {
                _id: productId,
                variants: { $elemMatch: { color: item.color, size: item.size } }
            },
            { $inc: { "variants.$.stock": -item.quantity } }
        );
    }
    return true;
};

// ─── User: Order listing with search/filter/pagination ───────────────────────

const getUserOrders = async (userId, query = {}) => {
    const {
        search = "",
        status = "",
        dateFrom = "",
        dateTo = "",
        page = 1,
        limit = 10,
    } = query;

    const filter = { userId };

    // Status filter
    if (status) {
        filter.orderStatus = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
        filter.createdOn = {};
        if (dateFrom) filter.createdOn.$gte = new Date(dateFrom);
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            filter.createdOn.$lte = end;
        }
    }

    // Search — by orderId or product name
    if (search) {
        const cleanSearch = search.trim().replace(/^#/, "");
        const searchRegex = new RegExp(cleanSearch, "i");
        filter.$or = [
            { orderId: searchRegex },
            { "orderedItems.productName": searchRegex },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    const orders = await Order.find(filter)
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    return {
        orders,
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
    };
};

// ─── User: Order detail with ownership check ─────────────────────────────────

const getOrderDetail = async (orderId, userId) => {
    const order = await Order.findById(orderId).populate("userId", "name email");

    if (!order) throw new Error("Order not found.");
    if (order.userId._id.toString() !== userId.toString()) {
        throw new Error("Unauthorized access.");
    }

    return order;
};

// ─── User: Cancel full order ─────────────────────────────────────────────────

const cancelOrder = async (orderId, userId, reason = "") => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.userId.toString() !== userId.toString())
        throw new Error("Unauthorized access.");
    if (!CANCELLABLE_STATUSES.includes(order.orderStatus))
        throw new Error(
            `Order cannot be cancelled. Current status: ${order.orderStatus}`
        );
    if (order.orderStatus === "Cancelled")
        throw new Error("Order is already cancelled.");

    // Restore stock for all active items
    for (const item of order.orderedItems) {
        if (item.itemStatus === "Active") {
            await Product.updateOne(
                {
                    _id: item.productId,
                    variants: { $elemMatch: { color: item.color, size: item.size } }
                },
                { $inc: { "variants.$.stock": item.quantity } }
            );
            item.itemStatus = "Cancelled";
            item.cancellationReason = reason || "Full order cancelled";
        }
    }

    _updateTotalOrderStatus(order);
    order.cancellationReason = reason || "Cancelled by customer";
    order.statusHistory.push({
        status: "Cancelled",
        date: new Date(),
        note: reason || "Order cancelled by customer",
    });

    await order.save();
    return order;
};

// ─── User: Cancel specific item ──────────────────────────────────────────────

const cancelOrderItem = async (orderId, itemId, userId, reason = "") => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.userId.toString() !== userId.toString())
        throw new Error("Unauthorized access.");
    if (!CANCELLABLE_STATUSES.includes(order.orderStatus))
        throw new Error(
            `Items cannot be cancelled. Current order status: ${order.orderStatus}`
        );

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");
    if (item.itemStatus !== "Active")
        throw new Error(`Item is already ${item.itemStatus}.`);

    // Restore stock for this item
    await Product.updateOne(
        {
            _id: item.productId,
            variants: { $elemMatch: { color: item.color, size: item.size } }
        },
        { $inc: { "variants.$.stock": item.quantity } }
    );

    item.itemStatus = "Cancelled";
    item.cancellationReason = reason || "Cancelled by customer";

    // Recalculate order totals (only active items)
    const activeItems = order.orderedItems.filter(
        (i) => i.itemStatus === "Active"
    );

    _updateTotalOrderStatus(order);
    if (order.orderStatus === "Cancelled") order.cancellationReason = "All items cancelled";
    
    order.statusHistory.push({
        status: "Item Cancelled",
        date: new Date(),
        note: `Item "${item.productName}" cancelled`,
    });

    // Recalculate totals from active items
    const newSubtotal = activeItems.reduce((sum, i) => sum + i.itemTotal, 0);
    order.subtotal = newSubtotal;
    order.finalAmount = newSubtotal + order.shippingCharge - order.discount;
    if (order.finalAmount < 0) order.finalAmount = 0;

    await order.save();
    return order;
};

// ─── User: Return full order ─────────────────────────────────────────────────

const requestReturn = async (orderId, userId, reason) => {
    if (!reason || !reason.trim())
        throw new Error("Return reason is required.");

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.userId.toString() !== userId.toString())
        throw new Error("Unauthorized access.");
    if (!['Delivered', 'Return Rejected'].includes(order.orderStatus))
        throw new Error("Return is only allowed for delivered orders.");

    // Check no duplicate return
    const returnStatuses = [
        "Return Requested",
        "Return Approved",
        "Return Rejected",
        "Returned",
    ];
    if (returnStatuses.includes(order.orderStatus))
        throw new Error("A return request already exists for this order.");

    // Mark all active items as Return Requested
    for (const item of order.orderedItems) {
        if (item.itemStatus === "Active") {
            item.itemStatus = "Return Requested";
            item.returnReason = reason.trim();
        }
    }

    _updateTotalOrderStatus(order);
    order.returnReason = reason.trim();
    order.statusHistory.push({
        status: "Return Requested",
        date: new Date(),
        note: reason.trim(),
    });

    await order.save();
    return order;
};

// ─── User: Return specific item ──────────────────────────────────────────────

const requestItemReturn = async (orderId, itemId, userId, reason) => {
    if (!reason || !reason.trim())
        throw new Error("Return reason is required.");

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.userId.toString() !== userId.toString())
        throw new Error("Unauthorized access.");
    if (!['Delivered', 'Return Rejected'].includes(order.orderStatus))
        throw new Error("Return is only allowed for delivered orders.");

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");
    if (item.itemStatus !== "Active")
        throw new Error(`Item cannot be returned. Current status: ${item.itemStatus}`);

    item.itemStatus = "Return Requested";
    item.returnReason = reason.trim();

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: "Return Requested",
        date: new Date(),
        note: `Return requested for "${item.productName}": ${reason.trim()}`,
    });

    await order.save();
    return order;
};

// ─── Admin: Order listing with search/sort/filter/pagination ─────────────────

const adminGetOrders = async (query = {}) => {
    const {
        search = "",
        status = "",
        dateFrom = "",
        dateTo = "",
        sortBy = "createdOn",
        sortOrder = "desc",
        page = 1,
        limit = 10,
    } = query;

    const filter = {};

    // Status filter
    if (status) {
        filter.orderStatus = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
        filter.createdOn = {};
        if (dateFrom) filter.createdOn.$gte = new Date(dateFrom);
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            filter.createdOn.$lte = end;
        }
    }

    // Search — by orderId, shipping name, or registered customer details (name, email, phone)
    if (search) {
        const cleanSearch = search.trim().replace(/^#/, "");
        const searchRegex = new RegExp(cleanSearch, "i");

        // Find users matching search term to include their orders
        const matchingUsers = await User.find({
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
            ],
        }).select("_id");
        const userIds = matchingUsers.map((u) => u._id);

        filter.$or = [
            { orderId: searchRegex },
            { "shippingAddress.name": searchRegex },
            { userId: { $in: userIds } },
        ];
    }

    // Sort
    const sortOptions = {};
    const allowedSortFields = ["createdOn", "finalAmount"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdOn";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    const orders = await Order.find(filter)
        .populate("userId", "name email phone")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    return {
        orders,
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
    };
};

// ─── Admin: Order detail ─────────────────────────────────────────────────────

const adminGetOrderDetail = async (orderId) => {
    const order = await Order.findById(orderId).populate(
        "userId",
        "name email phone"
    );
    if (!order) throw new Error("Order not found.");
    return order;
};

// ─── Admin: Update order status ──────────────────────────────────────────────

const adminUpdateOrderStatus = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const allowed = ALLOWED_TRANSITIONS[order.orderStatus];
    if (!allowed || !allowed.includes(newStatus)) {
        throw new Error(
            `Cannot transition from "${order.orderStatus}" to "${newStatus}".`
        );
    }

    order.orderStatus = newStatus;
    order.statusHistory.push({
        status: newStatus,
        date: new Date(),
        note: `Status updated to ${newStatus} by admin`,
    });

    // If delivered, update payment status for COD
    if (newStatus === "Delivered" && order.paymentMethod === "Cash on Delivery") {
        order.paymentStatus = "Paid";
    }

    // If cancelled by admin, restore stock
    if (newStatus === "Cancelled") {
        for (const item of order.orderedItems) {
            if (item.itemStatus === "Active") {
                await Product.updateOne(
                    {
                        _id: item.productId,
                        variants: { $elemMatch: { color: item.color, size: item.size } }
                    },
                    { $inc: { "variants.$.stock": item.quantity } }
                );
                item.itemStatus = "Cancelled";
                item.cancellationReason = "Cancelled by admin";
            }
        }
        order.cancellationReason = "Cancelled by admin";
    }

    await order.save();
    return order;
};

// ─── Admin: Approve full-order return ────────────────────────────────────────

const adminApproveReturn = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.orderStatus !== "Return Requested")
        throw new Error("Order is not in Return Requested status.");

    // Restore stock for all return-requested items
    for (const item of order.orderedItems) {
        if (item.itemStatus === "Return Requested") {
            await Product.updateOne(
                {
                    _id: item.productId,
                    variants: { $elemMatch: { color: item.color, size: item.size } }
                },
                { $inc: { "variants.$.stock": item.quantity } }
            );
            item.itemStatus = "Return Approved";
        }
    }

    _updateTotalOrderStatus(order);
    order.statusHistory.push({
        status: "Return Approved",
        date: new Date(),
        note: "Return approved by admin",
    });

    await order.save();
    return order;
};

// ─── Admin: Reject full-order return ─────────────────────────────────────────

const adminRejectReturn = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.orderStatus !== "Return Requested")
        throw new Error("Order is not in Return Requested status.");

    for (const item of order.orderedItems) {
        if (item.itemStatus === "Return Requested") {
            item.itemStatus = "Return Rejected";
        }
    }

    _updateTotalOrderStatus(order);
    order.statusHistory.push({
        status: "Return Rejected",
        date: new Date(),
        note: "Return rejected by admin",
    });

    await order.save();
    return order;
};

// ─── Admin: Approve single-item return ───────────────────────────────────────

const adminApproveItemReturn = async (orderId, itemId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");
    if (item.itemStatus !== "Return Requested")
        throw new Error("Item is not in Return Requested status.");

    // Restore stock
    await Product.updateOne(
        {
            _id: item.productId,
            variants: { $elemMatch: { color: item.color, size: item.size } }
        },
        { $inc: { "variants.$.stock": item.quantity } }
    );

    item.itemStatus = "Return Approved";

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: "Return Approved",
        date: new Date(),
        note: `Return approved for "${item.productName}"`,
    });

    await order.save();
    return order;
};

// ─── Admin: Reject single-item return ────────────────────────────────────────

const adminRejectItemReturn = async (orderId, itemId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");
    if (item.itemStatus !== "Return Requested")
        throw new Error("Item is not in Return Requested status.");

    item.itemStatus = "Return Rejected";

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: "Return Rejected",
        date: new Date(),
        note: `Return rejected for "${item.productName}"`,
    });

    await order.save();
    return order;
};

// ─── Admin: Mark single-item as Returned ───────────────────────────────────────

const adminCompleteItemReturn = async (orderId, itemId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");
    if (item.itemStatus !== "Return Approved")
        throw new Error("Item return must be approved before marking as Returned.");

    item.itemStatus = "Returned";

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: "Returned",
        date: new Date(),
        note: `Item "${item.productName}" marked as Returned`,
    });

    await order.save();
    return order;
};

// ─── Invoice number generation ───────────────────────────────────────────────

const generateInvoiceNumber = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    if (order.invoiceNumber) return order.invoiceNumber;

    const seq = await Counter.getNextSequence("invoiceNumber");
    order.invoiceNumber = `INV-${seq}`;
    await order.save();
    return order.invoiceNumber;
};

// ─── Admin: Inventory/Stock Management ───────────────────────────────────────

const getInventoryData = async (query = {}) => {
    const {
        search = "",
        stockFilter = "",
        page = 1,
        limit = 15,
    } = query;

    const filter = { isDeleted: false };

    if (search) {
        const searchRegex = new RegExp(search, "i");
        filter.$or = [
            { productName: searchRegex },
            { "variants.sku": searchRegex },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    let products = await Product.find(filter)
        .populate("category", "name")
        .sort({ productName: 1 })
        .skip(skip)
        .limit(parseInt(limit));

    // Apply stock-level filter in memory (since stock is per-variant)
    if (stockFilter === "outOfStock") {
        products = products.filter((p) =>
            p.variants.some((v) => v.stock === 0)
        );
    } else if (stockFilter === "lowStock") {
        products = products.filter((p) =>
            p.variants.some((v) => v.stock > 0 && v.stock <= 5)
        );
    }

    return {
        products,
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
    };
};

const updateVariantStock = async (productId, variantId, newStock) => {
    if (newStock < 0) throw new Error("Stock cannot be negative.");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found.");

    const variant = product.variants.id(variantId);
    if (!variant) throw new Error("Variant not found.");

    variant.stock = parseInt(newStock);
    await product.save();
    return product;
};

module.exports = {
    getCheckoutData,
    placeOrder,
    getOrderById,
    getUserOrders,
    getOrderDetail,
    cancelOrder,
    cancelOrderItem,
    requestReturn,
    requestItemReturn,
    adminGetOrders,
    adminGetOrderDetail,
    adminUpdateOrderStatus,
    adminApproveReturn,
    adminRejectReturn,
    adminApproveItemReturn,
    adminRejectItemReturn,
    adminCompleteItemReturn,
    generateInvoiceNumber,
    getInventoryData,
    updateVariantStock,
    checkStockForOrder,
    deductStockForOrder
};
