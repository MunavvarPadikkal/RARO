const Order = require("../models/orderSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Address = require("../models/addressSchema");
const Counter = require("../models/counterSchema");
const User = require("../models/userSchema");
const Coupon = require("../models/couponSchema");
const refundService = require("./refundService");
const referralService = require("./referralService");
const { distributeCouponDiscount } = require("../utils/orderUtils");
const { v4: uuidv4 } = require("uuid");

const getProductPrice = (product) => {
    return product.salePrice < product.regularPrice ? product.salePrice : product.regularPrice;
};

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
    
    // Check if all items are in terminal inactive states
    const allTerminal = items.every(i => ["Cancelled", "Returned", "Return Approved"].includes(i.itemStatus));
    
    if (allTerminal) {
        const anyReturned = items.some(i => ["Returned", "Return Approved"].includes(i.itemStatus));
        order.orderStatus = anyReturned ? "Returned" : "Cancelled";
        return;
    }

    // Status Hierarchy (Highest priority wins for the total order status)
    const statusPriority = ["Return Requested", "Out for Delivery", "Shipped", "Delivered", "Pending", "Placed"];
    
    for (const status of statusPriority) {
        if (items.some(i => i.itemStatus === status || (status === "Delivered" && i.itemStatus === "Return Rejected"))) {
            order.orderStatus = status;
            
            // Special Case: If any item is Delivered/Rejected, but others are Shipped/Pending, 
            // the order as a whole is still Shipped.
            if (status === "Delivered" && items.some(i => ["Shipped", "Out for Delivery"].includes(i.itemStatus))) {
                continue; 
            }
            
            break;
        }
    }
};

// ─── Totals update helper ───────────────────────────────────────────────────
const _updateOrderTotals = (order, cancelledItem) => {
    if (!cancelledItem) return;
    
    // Subtract cancelled item values from order totals
    // Using stored proportional coupon values
    order.subtotal = Math.max(0, Math.round((order.subtotal - cancelledItem.itemTotal) * 100) / 100);
    order.discount = Math.max(0, Math.round((order.discount - (cancelledItem.totalCouponDiscount || 0)) * 100) / 100);
    order.finalAmount = Math.max(0, Math.round((order.finalAmount - (cancelledItem.finalItemTotal || cancelledItem.itemTotal)) * 100) / 100);
};

// ─── Checkout helpers (preserved from original) ──────────────────────────────

const getCheckoutData = async (userId) => {
    const cart = await Cart.findOne({ userId }).populate("items.productId").populate("appliedCoupon");
    if (!cart || cart.items.length === 0) {
        throw new Error("CART_EMPTY");
    }

    const userAddress = await Address.findOne({ userId });
    const addresses = userAddress ? userAddress.address : [];

    const cartItems = cart.items
        .filter((item) => item.productId)
        .map((item) => {
            const currentPrice = item.productId.salePrice;
            const variant = item.productId.variants.find(
                (v) => v.color === item.color && v.size === item.size
            );
            const availableStock = variant ? variant.stock : 0;
            const isOutOfStock = availableStock < item.quantity || item.productId.isBlocked || item.productId.isDeleted;

            return {
                _id: item._id,
                productId: item.productId._id,
                productName: item.productId.productName,
                productImage: item.productId.productImage[0] || "",
                size: item.size,
                color: item.color,
                quantity: item.quantity,
                price: currentPrice,
                originalPrice: item.productId.regularPrice,
                offerDiscount: item.productId.productOffer || 0,
                regularPrice: item.productId.regularPrice,
                itemTotal: currentPrice * item.quantity,
                availableStock,
                isOutOfStock
            };
        });

    const subtotal = cartItems.reduce((acc, item) => acc + item.itemTotal, 0);
    const shippingCharge = 0;
    
    let discount = 0;
    let appliedCoupon = null;

    if (cart.appliedCoupon) {
        const coupon = cart.appliedCoupon;
        const now = new Date();
        
        // Re-validate coupon
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
            appliedCoupon = coupon;
        } else {
            // Auto remove invalid coupon from cart
            cart.appliedCoupon = null;
            await cart.save();
        }
    }

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
        appliedCoupon
    };
};

const placeOrder = async (userId, addressId, paymentMethod = "Cash on Delivery", paymentStatus = null, paymentDetails = null, walletAmountUsed = 0) => {
    const cart = await Cart.findOne({ userId }).populate("items.productId").populate("appliedCoupon");
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
    let orderItems = cart.items.map((item) => {
        const currentPrice = item.productId.salePrice;
        return {
            productId: item.productId._id,
            productName: item.productId.productName,
            productImage: item.productId.productImage[0] || "",
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            originalPrice: item.productId.regularPrice,
            offerDiscount: item.productId.productOffer || 0,
            price: currentPrice,
            itemTotal: currentPrice * item.quantity,
            itemStatus: "Placed",
        };
    });

    // Calculate totals
    const subtotal = orderItems.reduce((acc, item) => acc + item.itemTotal, 0);
    const shippingCharge = 0;
    
    // Coupon Logic
    let discount = 0;
    let couponCode = null;
    let appliedCouponId = null;

    if (cart.appliedCoupon) {
        const coupon = cart.appliedCoupon;
        const now = new Date();
        
        // Re-validate coupon
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
            couponCode = coupon.code;
            appliedCouponId = coupon._id;
        } else {
            // If invalid at placement, block the order and notify user
            cart.appliedCoupon = null;
            await cart.save();
            throw new Error("Applied coupon is no longer valid. Please review checkout.");
        }
    }

    // Apply proportional coupon distribution
    orderItems = distributeCouponDiscount(orderItems, discount, subtotal);

    const finalAmount = subtotal + shippingCharge - discount;

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
        walletAmountUsed: walletAmountUsed,
        paymentStatus: paymentStatus ? paymentStatus : (paymentMethod === "Razorpay" ? "Paid" : "Pending"),
        razorpayOrderId: paymentDetails?.razorpayOrderId || null,
        razorpayPaymentId: paymentDetails?.razorpayPaymentId || null,
        orderStatus: paymentStatus === "Failed" ? "Payment Failed" : "Placed",
        subtotal: subtotal,
        discount: discount,
        shippingCharge: shippingCharge,
        finalAmount: finalAmount,
        couponApplied: !!couponCode,
        couponCode: couponCode,
        couponId: appliedCouponId,
        invoiceNumber: invoiceNumber,
        statusHistory: [{ status: paymentStatus === "Failed" ? "Payment Failed" : "Placed", date: new Date(), note: paymentStatus === "Failed" ? "Payment failed during checkout" : "Order placed successfully" }],
        createdOn: new Date(),
    });

    await newOrder.save();

    // If order successful (not failed payment), update coupon usage and deduct stock
    if (paymentStatus !== "Failed") {
        // Update Coupon Usage
        await incrementCouponUsage(appliedCouponId, userId);

        // Deduct Stock
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

// Increment usage count for a coupon
const incrementCouponUsage = async (couponId, userId) => {
    if (!couponId) return;
    const coupon = await Coupon.findById(couponId);
    if (coupon) {
        coupon.usageCount += 1;
        const userIndex = coupon.usersUsed.findIndex(u => u.userId.toString() === userId.toString());
        if (userIndex > -1) {
            coupon.usersUsed[userIndex].count += 1;
        } else {
            coupon.usersUsed.push({ userId: userId, count: 1 });
        }
        await coupon.save();
    }
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

    // Calculate refund amount before updating order totals
    let amountToRefund = 0;
    if (order.paymentStatus === "Paid" || order.paymentMethod === "Wallet") {
        for (const item of order.orderedItems) {
            if (item.itemStatus === "Active") {
                amountToRefund += (item.finalItemTotal || item.itemTotal);
            }
        }
    }

    // Restore stock for all non-terminal items
    for (const item of order.orderedItems) {
        if (!["Cancelled", "Returned", "Return Approved"].includes(item.itemStatus)) {
            await Product.updateOne(
                {
                    _id: item.productId,
                    variants: { $elemMatch: { color: item.color, size: item.size } }
                },
                { $inc: { "variants.$.stock": item.quantity } }
            );
            item.itemStatus = "Cancelled";
            item.cancellationReason = reason || "Full order cancelled";
            _updateOrderTotals(order, item);
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

    // Trigger Refund if there's anything to refund
    if (amountToRefund > 0) {
        await refundService.createRefundRequest(order, null, "cancel", reason || "Order cancelled", amountToRefund);
    }

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
    if (item.itemStatus === CANCELLABLE_STATUSES)
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

    _updateOrderTotals(order, item);
    _updateTotalOrderStatus(order);
    if (order.orderStatus === "Cancelled") order.cancellationReason = "All items cancelled";
    
    order.statusHistory.push({
        status: "Item Cancelled",
        date: new Date(),
        note: `Item "${item.productName}" cancelled`,
    });

    // Totals updated via _updateOrderTotals helper above.
    // Refund will be handled separately via refundAmount.

    await order.save();

    // Trigger Refund if order was paid
    if (order.paymentStatus === "Paid" || order.paymentMethod === "Wallet") {
        await refundService.createRefundRequest(order, itemId, "cancel", reason || "Item cancelled");
    }

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
    if (["Cancelled", "Returned", "Return Approved"].includes(item.itemStatus))
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
    
    // Propagate status to all items that are not already terminal
    const terminalStatuses = ["Cancelled", "Returned", "Return Approved"];
    
    // If not a terminal status, just update non-terminal items
    if (!terminalStatuses.includes(newStatus)) {
        for (const item of order.orderedItems) {
            if (!terminalStatuses.includes(item.itemStatus)) {
                item.itemStatus = newStatus;
            }
        }
    }
    order.statusHistory.push({
        status: newStatus,
        date: new Date(),
        note: `Status updated to ${newStatus} by admin`,
    });

    // If delivered, update payment status for COD
    if (newStatus === "Delivered" && order.paymentMethod === "Cash on Delivery") {
        order.paymentStatus = "Paid";
    }

    // If delivered, process referral reward for the user's first successful order
    if (newStatus === "Delivered") {
        try {
            await referralService.processReferralReward(order.userId, order.finalAmount);
        } catch (refErr) {
            console.error("Referral reward processing failed (non-blocking):", refErr.message);
        }
    }

    // If cancelled by admin, restore stock and calculate refund
    if (newStatus === "Cancelled") {
        let amountToRefund = 0;
        const isPaid = order.paymentStatus === "Paid" || order.paymentMethod === "Wallet";

        for (const item of order.orderedItems) {
            // Check for any active status (legacy 'Active' or new lifecycle statuses)
            const isActive = !["Cancelled", "Returned", "Return Approved"].includes(item.itemStatus);
            if (isActive) {
                if (isPaid) {
                    amountToRefund += (item.finalItemTotal || item.itemTotal);
                }
                await Product.updateOne(
                    {
                        _id: item.productId,
                        variants: { $elemMatch: { color: item.color, size: item.size } }
                    },
                    { $inc: { "variants.$.stock": item.quantity } }
                );
                item.itemStatus = "Cancelled";
                item.cancellationReason = "Cancelled by admin";
                _updateOrderTotals(order, item);
            }
        }
        order.cancellationReason = "Cancelled by admin";

        if (amountToRefund > 0) {
            await refundService.createRefundRequest(order, null, "cancel", "Cancelled by admin", amountToRefund);
        }
    }
    
    // If returned by admin, restore stock and calculate refund
    if (newStatus === "Returned") {
        let amountToRefund = 0;
        const isPaid = order.paymentStatus === "Paid" || order.paymentMethod === "Wallet";

        for (const item of order.orderedItems) {
            const isActive = !["Cancelled", "Returned", "Return Approved"].includes(item.itemStatus);
            if (isActive || item.itemStatus === "Return Requested" || item.itemStatus === "Return Approved") {
                if (isPaid) {
                    amountToRefund += (item.finalItemTotal || item.itemTotal);
                }
                // Stock restoration (if not already restored by Approve)
                if (isActive || item.itemStatus === "Return Requested") {
                    await Product.updateOne(
                        {
                            _id: item.productId,
                            variants: { $elemMatch: { color: item.color, size: item.size } }
                        },
                        { $inc: { "variants.$.stock": item.quantity } }
                    );
                }
                item.itemStatus = "Returned";
                _updateOrderTotals(order, item);
            }
        }
        order.returnReason = "Marked as Returned by admin";

        if (amountToRefund > 0) {
            await refundService.createRefundRequest(order, null, "return", "Order marked as Returned by admin", amountToRefund);
        }
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

    // Calculate refund amount before updating order totals
    let amountToRefund = 0;
    if (order.paymentStatus === "Paid" || order.paymentMethod === "Wallet") {
        for (const item of order.orderedItems) {
            if (item.itemStatus === "Return Requested") {
                amountToRefund += (item.finalItemTotal || item.itemTotal);
            }
        }
    }

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
            _updateOrderTotals(order, item);
        }
    }

    _updateTotalOrderStatus(order);
    order.statusHistory.push({
        status: "Return Approved",
        date: new Date(),
        note: "Return approved by admin",
    });

    await order.save();

    // Trigger Refund for return
    if (amountToRefund > 0) {
        await refundService.createRefundRequest(order, null, "return", "Full order return approved", amountToRefund);
    }

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
    _updateOrderTotals(order, item);

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: "Return Approved",
        date: new Date(),
        note: `Return approved for "${item.productName}"`,
    });

    await order.save();

    // Trigger Refund for return
    if (order.paymentStatus === "Paid" || order.paymentMethod === "Wallet") {
        await refundService.createRefundRequest(order, itemId, "return", "Item return approved");
    }

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

// ─── Admin: Update Single Item Status ────────────────────────────────────────

const adminUpdateItemStatus = async (orderId, itemId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order.");

    if (item.itemStatus === newStatus) return order;

    const oldStatus = item.itemStatus;
    item.itemStatus = newStatus;

    // Handle Stock & Refund for Terminal Statuses
    if (newStatus === "Cancelled" || newStatus === "Returned" || newStatus === "Return Approved") {
        // Restore stock ONLY if transitioning FROM an active status (Active, Return Requested, Return Rejected)
        // to a terminal status (Cancelled, Returned, Return Approved)
        const isActive = ["Active", "Return Requested", "Return Rejected"].includes(oldStatus);
        
        if (isActive) {
             await Product.updateOne(
                {
                    _id: item.productId,
                    variants: { $elemMatch: { color: item.color, size: item.size } }
                },
                { $inc: { "variants.$.stock": item.quantity } }
            );
        }

        // Trigger Refund if paid and not already refunded for this item
        // We check payment status or if it was paid by wallet
        const isPaid = order.paymentStatus === "Paid" || order.paymentMethod === "Wallet";
        if (isPaid && isActive) {
             const type = newStatus === "Cancelled" ? "cancel" : "return";
             await refundService.createRefundRequest(order, itemId, type, `Item status updated to ${newStatus} by admin`);
        }
        
        // Update order totals (reduce subtotal, discount, etc. for this item)
        if (isActive) {
            _updateOrderTotals(order, item);
        }
    }

    _updateTotalOrderStatus(order);

    order.statusHistory.push({
        status: `Item ${newStatus}`,
        date: new Date(),
        note: `Status for "${item.productName}" updated to ${newStatus} by admin`,
    });

    await order.save();
    return order;
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
    adminUpdateItemStatus,
    generateInvoiceNumber,
    getInventoryData,
    updateVariantStock,
    checkStockForOrder,
    deductStockForOrder,
    incrementCouponUsage
};
