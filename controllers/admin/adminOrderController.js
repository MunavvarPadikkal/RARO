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
            "Return Requested": ["Return Approved", "Return Rejected"],
            "Return Approved": ["Returned"],
            "Return Rejected": [],
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
        const { search, returnStatus, page } = req.query;

        const filter = {};

        // Filter for orders that have return-related statuses
        const returnStatuses = [
            "Return Requested",
            "Return Approved",
            "Return Rejected",
            "Returned",
        ];

        if (returnStatus && returnStatuses.includes(returnStatus)) {
            filter.orderStatus = returnStatus;
        } else {
            filter.orderStatus = { $in: returnStatuses };
        }

        if (search) {
            const cleanSearch = search.trim().replace(/^#/, "");
            const searchRegex = new RegExp(cleanSearch, "i");

            // Find users matching search term
            const matchingUsers = await User.find({
                $or: [
                    { name: searchRegex },
                    { email: searchRegex },
                    { phone: searchRegex }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            filter.$or = [
                { orderId: searchRegex },
                { "shippingAddress.name": searchRegex },
                { userId: { $in: userIds } }
            ];
        }

        const skip = (parseInt(page || 1) - 1) * 10;
        const totalOrders = await require("../../models/orderSchema").countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / 10);

        const orders = await require("../../models/orderSchema")
            .find(filter)
            .populate("userId", "name email")
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(10);

        return res.render("adminReturns", {
            orders,
            currentPage: parseInt(page || 1),
            totalPages,
            totalOrders,
            search: search || "",
            returnStatus: returnStatus || "",
        });
    } catch (error) {
        console.error("Admin loadReturnRequests error:", error);
        return res.redirect("/admin/dashboard");
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
    loadInventory,
    updateStock,
};
