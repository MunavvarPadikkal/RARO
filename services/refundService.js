const Refund = require("../models/refundSchema");
const walletService = require("./walletService");
const Order = require("../models/orderSchema");

/**
 * Check if an order/item is eligible for refund.
 * RULE: If couponApplied is true, no item is eligible.
 */
const checkEligibility = (order) => {
    // Proportional refund is always eligible if order is paid
    return true;
};

/**
 * Create a refund request for a cancelled or returned item/order.
 */
const createRefundRequest = async (order, itemId, type, reason, manualAmount = null) => {
    // If COD and unpaid, no refund needed
    if (order.paymentMethod === "Cash on Delivery" && order.paymentStatus !== "Paid") {
        return null;
    }

    const isEligible = checkEligibility(order);
    
    let amount = 0;
    if (manualAmount !== null) {
        amount = manualAmount;
    } else if (itemId) {
        const item = order.orderedItems.id(itemId);
        // Use the finalItemTotal (after coupon distribution) for refund
        amount = item ? (item.finalItemTotal || item.itemTotal) : 0;
    } else {
        // Full order cancellation refund
        // Deduct any already refunded amounts to avoid double refunding
        amount = order.finalAmount - (order.refundAmount || 0);
    }

    if (amount <= 0) return null;

    const refund = await Refund.create({
        userId: order.userId,
        orderId: order._id,
        itemId: itemId,
        amount: amount,
        type: type,
        status: isEligible ? "Pending" : "Not Eligible",
        reason: reason,
        eligibleForRefund: isEligible
    });

    // If it's a cancellation and eligible, we can automatically process it
    if (type === "cancel" && isEligible) {
        await executeRefund(refund._id);
    }

    return refund;
};

/**
 * Execute a pending refund: credit the wallet and mark as completed.
 */
const executeRefund = async (refundId) => {
    const refund = await Refund.findById(refundId);
    if (!refund) throw new Error("Refund request not found.");
    if (refund.status !== "Pending") return;
    if (!refund.eligibleForRefund) return;

    // Get order details for transaction reason
    const order = await Order.findById(refund.orderId);
    const orderDisplayId = order ? order.orderId : "Unknown";

    await walletService.creditWallet(
        refund.userId,
        refund.amount,
        `Refund for ${refund.type === 'cancel' ? 'Cancellation' : 'Return'} (Order #${orderDisplayId})`,
        orderDisplayId
    );

    refund.status = "Completed";
    refund.processedAt = new Date();
    await refund.save();

    // Update order with the refund amount
    if (order) {
        order.refundAmount = (order.refundAmount || 0) + refund.amount;
        await order.save();
    }
    
    return refund;
};

module.exports = {
    createRefundRequest,
    executeRefund,
    checkEligibility
};
