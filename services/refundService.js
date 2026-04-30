const Refund = require("../models/refundSchema");
const walletService = require("./walletService");
const Order = require("../models/orderSchema");

/**
 * Check if an order/item is eligible for refund.
 * RULE: If couponApplied is true, no item is eligible.
 */
const checkEligibility = (order) => {
    return !order.couponApplied;
};

/**
 * Create a refund request for a cancelled or returned item/order.
 */
const createRefundRequest = async (order, itemId, type, reason) => {
    const isEligible = checkEligibility(order);
    
    let amount = 0;
    if (itemId) {
        const item = order.orderedItems.id(itemId);
        amount = item ? item.itemTotal : 0;
    } else {
        // Full order cancellation refund (excluding shipping if already shipped, but for now we assume full)
        amount = order.finalAmount;
    }

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
    
    return refund;
};

module.exports = {
    createRefundRequest,
    executeRefund,
    checkEligibility
};
