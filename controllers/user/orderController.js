const orderService = require("../../services/orderService");
const mongoose = require("mongoose");

/**
 * GET /orders
 * Render the dynamic My Orders page with search, filter, pagination.
 */
const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { search, status, dateFrom, dateTo, page } = req.query;

        const result = await orderService.getUserOrders(userId, {
            search,
            status,
            dateFrom,
            dateTo,
            page: page || 1,
            limit: 5,
        });

        return res.render("orders", {
            user: req.session.user,
            orders: result.orders,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalOrders: result.totalOrders,
            search: search || "",
            status: status || "",
            dateFrom: dateFrom || "",
            dateTo: dateTo || "",
            activeTab: "orders",
        });
    } catch (error) {
        console.error("Error loading orders:", error);
        return res.redirect("/profile");
    }
};

/**
 * GET /orders/:orderId
 * Render the order detail page.
 */
const loadOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.redirect("/orders");
        }

        const order = await orderService.getOrderDetail(orderId, userId);

        return res.render("order-detail", {
            user: req.session.user,
            order,
            activeTab: "orders",
        });
    } catch (error) {
        console.error("Error loading order detail:", error);
        return res.redirect("/orders");
    }
};

/**
 * POST /orders/:orderId/cancel
 * Cancel the entire order.
 */
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        await orderService.cancelOrder(orderId, userId, reason);
        return res.json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        console.error("Error cancelling order:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to cancel order.",
        });
    }
};

/**
 * POST /orders/:orderId/items/:itemId/cancel
 * Cancel a specific item in the order.
 */
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user._id;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        await orderService.cancelOrderItem(orderId, itemId, userId, reason);
        return res.json({ success: true, message: "Item cancelled successfully." });
    } catch (error) {
        console.error("Error cancelling item:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to cancel item.",
        });
    }
};

/**
 * POST /orders/:orderId/return
 * Submit return request for the entire order.
 */
const requestReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        await orderService.requestReturn(orderId, userId, reason);
        return res.json({ success: true, message: "Return request submitted successfully." });
    } catch (error) {
        console.error("Error requesting return:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to submit return request.",
        });
    }
};

/**
 * POST /orders/:orderId/items/:itemId/return
 * Submit return request for a specific item.
 */
const requestItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user._id;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        await orderService.requestItemReturn(orderId, itemId, userId, reason);
        return res.json({ success: true, message: "Return request submitted for item." });
    } catch (error) {
        console.error("Error requesting item return:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to submit return request.",
        });
    }
};

/**
 * GET /orders/:orderId/invoice
 * Render the invoice page for PDF download.
 */
const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid order ID.");
        }

        const order = await orderService.getOrderDetail(orderId, userId);

        // Ensure invoice number exists
        if (!order.invoiceNumber) {
            await orderService.generateInvoiceNumber(orderId);
            // Re-fetch to get the updated invoice number
            const updatedOrder = await orderService.getOrderDetail(orderId, userId);
            return res.render("invoice", { user: req.session.user, order: updatedOrder });
        }

        return res.render("invoice", { user: req.session.user, order });
    } catch (error) {
        console.error("Error loading invoice:", error);
        return res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    loadOrders,
    loadOrderDetail,
    cancelOrder,
    cancelOrderItem,
    requestReturn,
    requestItemReturn,
    downloadInvoice,
};
