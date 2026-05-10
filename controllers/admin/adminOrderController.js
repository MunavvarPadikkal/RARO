const orderService = require("../../services/orderService");
const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

// ─── Admin: Order Listing ────────────────────────────────────────────────────

/**
 * GET /admin/orders
 * Render admin order list with search, sort, filter, pagination.
 */
const loadOrders = async (req, res) => {
    try {
        const { search, status, sortBy, sortOrder, dateFrom, dateTo, page } =
            req.query;

        const result = await orderService.adminGetOrders({
            search,
            status,
            sortBy: sortBy || "createdOn",
            sortOrder: sortOrder || "desc",
            dateFrom,
            dateTo,
            page: page || 1,
            limit: 10,
        });

        return res.render("adminOrders", {
            orders: result.orders,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalOrders: result.totalOrders,
            search: search || "",
            status: status || "",
            sortBy: sortBy || "createdOn",
            sortOrder: sortOrder || "desc",
            dateFrom: dateFrom || "",
            dateTo: dateTo || "",
        });
    } catch (error) {
        console.error("Admin loadOrders error:", error);
        return res.redirect("/admin/dashboard");
    }
};

// ─── Admin: Order Detail ─────────────────────────────────────────────────────

/**
 * GET /admin/orders/:orderId
 * Render admin order detail with status change dropdown.
 */
const loadOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.redirect("/admin/orders");
        }

        const order = await orderService.adminGetOrderDetail(orderId);

        // Define allowed next statuses for the dropdown
        const allowedTransitions = {
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

        const nextStatuses = allowedTransitions[order.orderStatus] || [];

        return res.render("adminOrderDetail", {
            order,
            nextStatuses,
        });
    } catch (error) {
        console.error("Admin loadOrderDetail error:", error);
        return res.redirect("/admin/orders");
    }
};

// ─── Admin: Update Order Status ──────────────────────────────────────────────

/**
 * POST /admin/orders/:orderId/status
 * Change order status via AJAX.
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { newStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid order ID." });
        }

        if (!newStatus) {
            return res
                .status(400)
                .json({ success: false, message: "New status is required." });
        }

        const order = await orderService.adminUpdateOrderStatus(
            orderId,
            newStatus
        );
        return res.json({
            success: true,
            message: `Order status updated to ${newStatus}.`,
            order,
        });
    } catch (error) {
        console.error("Admin updateOrderStatus error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update order status.",
        });
    }
};

// ─── Admin: Return Requests ──────────────────────────────────────────────────

/**
 * GET /admin/return-requests
 * List all return requests with filtering.
 */
const loadReturnRequests = async (req, res) => {
    try {
        const { search, returnStatus, page = 1 } = req.query;
        const limit = 10;
        const skip = (parseInt(page) - 1) * limit;

        const returnStatuses = ["Return Requested", "Return Approved", "Return Rejected", "Returned"];
        
        const filter = {
            "orderedItems.itemStatus": { $in: returnStatuses }
        };

        // Fetch orders that have relevant items and populate user details
        const orders = await Order.find(filter)
            .populate("userId", "name email")
            .sort({ updatedAt: -1 });

        // Flatten items manually to show one item per row
        let allReturnItems = [];
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (returnStatuses.includes(item.itemStatus)) {
                    // Filter by specific return status if requested
                    if (!returnStatus || item.itemStatus === returnStatus) {
                        
                        // Filter by search term if provided
                        let matchesSearch = true;
                        if (search) {
                            const cleanSearch = search.trim().toLowerCase();
                            const orderMatch = order.orderId.toLowerCase().includes(cleanSearch);
                            const productMatch = item.productName.toLowerCase().includes(cleanSearch);
                            const userMatch = order.userId && (
                                order.userId.name.toLowerCase().includes(cleanSearch) || 
                                order.userId.email.toLowerCase().includes(cleanSearch)
                            );
                            matchesSearch = orderMatch || productMatch || userMatch;
                        }

                        if (matchesSearch) {
                            allReturnItems.push({
                                _id: order._id,
                                orderId: order.orderId,
                                userDetails: order.userId,
                                orderedItems: item,
                                updatedAt: order.updatedAt
                            });
                        }
                    }
                }
            });
        });

        // Sort the flattened list to ensure "Return Requested" items are at the top,
        // then sort by updatedAt descending (newest first).
        allReturnItems.sort((a, b) => {
            const isRequestedA = a.orderedItems.itemStatus === "Return Requested";
            const isRequestedB = b.orderedItems.itemStatus === "Return Requested";

            // 1. Primary sort: Prioritize "Return Requested" status
            if (isRequestedA !== isRequestedB) {
                return isRequestedA ? -1 : 1;
            }

            // 2. Secondary sort: Update date (Newest first)
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            
            if (dateB !== dateA) {
                return dateB - dateA;
            }

            // 3. Tertiary sort: Stable sort by Order ID
            return (b.orderId || "").localeCompare(a.orderId || "");
        });

        // Pagination for the flattened list
        const totalItems = allReturnItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const returnItems = allReturnItems.slice(skip, skip + limit);

        return res.render("adminReturns", {
            returnItems,
            currentPage: parseInt(page),
            totalPages,
            totalItems,
            search: search || "",
            returnStatus: returnStatus || "",
        });
    } catch (error) {
        console.error("Admin loadReturnRequests error:", error);
        return res.redirect("/admin/pageError");
    }
};

// ─── Admin: Approve/Reject Returns ───────────────────────────────────────────

const approveReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }
        await orderService.adminApproveReturn(orderId);
        return res.json({ success: true, message: "Return approved successfully." });
    } catch (error) {
        console.error("Admin approveReturn error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to approve return.",
        });
    }
};

const rejectReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }
        await orderService.adminRejectReturn(orderId);
        return res.json({ success: true, message: "Return rejected." });
    } catch (error) {
        console.error("Admin rejectReturn error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to reject return.",
        });
    }
};

const approveItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }
        await orderService.adminApproveItemReturn(orderId, itemId);
        return res.json({ success: true, message: "Item return approved." });
    } catch (error) {
        console.error("Admin approveItemReturn error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to approve item return.",
        });
    }
};

const rejectItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }
        await orderService.adminRejectItemReturn(orderId, itemId);
        return res.json({ success: true, message: "Item return rejected." });
    } catch (error) {
        console.error("Admin rejectItemReturn error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to reject item return.",
        });
    }
};

const completeItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }
        await orderService.adminCompleteItemReturn(orderId, itemId);
        return res.json({ success: true, message: "Item marked as Returned." });
    } catch (error) {
        console.error("Admin completeItemReturn error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to complete item return.",
        });
    }
};

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { newStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        if (!newStatus) {
            return res.status(400).json({ success: false, message: "New status is required." });
        }

        await orderService.adminUpdateItemStatus(orderId, itemId, newStatus);
        return res.json({
            success: true,
            message: `Item status updated to ${newStatus}.`,
        });
    } catch (error) {
        console.error("Admin updateItemStatus error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update item status.",
        });
    }
};

// ─── Admin: Inventory/Stock Management ───────────────────────────────────────

/**
 * GET /admin/inventory
 * Render inventory page with all products and variant stock levels.
 */
const loadInventory = async (req, res) => {
    try {
        const { search, stockFilter, page } = req.query;

        const result = await orderService.getInventoryData({
            search,
            stockFilter,
            page: page || 1,
            limit: 15,
        });

        return res.render("adminInventory", {
            products: result.products,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalProducts: result.totalProducts,
            search: search || "",
            stockFilter: stockFilter || "",
        });
    } catch (error) {
        console.error("Admin loadInventory error:", error);
        return res.redirect("/admin/dashboard");
    }
};

/**
 * POST /admin/inventory/update-stock
 * Update stock for a specific product variant.
 */
const updateStock = async (req, res) => {
    try {
        const { productId, variantId, newStock } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }

        if (newStock === undefined || newStock === null || newStock < 0) {
            return res.status(400).json({ success: false, message: "Invalid stock value." });
        }

        await orderService.updateVariantStock(productId, variantId, newStock);
        return res.json({ success: true, message: "Stock updated successfully." });
    } catch (error) {
        console.error("Admin updateStock error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update stock.",
        });
    }
};

module.exports = {
    loadOrders,
    loadOrderDetail,
    updateOrderStatus,
    loadReturnRequests,
    approveReturn,
    rejectReturn,
    approveItemReturn,
    rejectItemReturn,
    completeItemReturn,
    updateItemStatus,
    loadInventory,
    updateStock,
};
