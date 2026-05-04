const dashboardService = require("../../services/dashboardService");
const adminService = require("../../services/adminService");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Refund = require("../../models/refundSchema");
const refundService = require("../../services/refundService");





const pageError = async (req, res) => {
    res.render("pageError");
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    res.render("admin-login", { message: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await adminService.findAdminByEmail(email);
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin");
            } else {
                return res.render("admin-login", { message: "Incorrect password" });
            }
        } else {
            return res.render("admin-login", { message: "Admin not found with this email" });
        }


    } catch (error) {
        console.log("login error", error);
        return res.redirect("/pageError")
    }
}


const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin/login");
        }
        
        const metrics = await dashboardService.getDashboardMetrics();
        const { topProducts, topCategories } = await dashboardService.getBestSellingMetrics();
        
        res.render("dashboard", {
            metrics,
            topProducts,
            topCategories
        });
    } catch (error) {
        console.error("Dashboard load error:", error);
        res.redirect("/admin/pageError");
    }
}

const getChartData = async (req, res) => {
    try {
        const { filter = "monthly" } = req.query;
        const chartData = await dashboardService.getSalesChartData(filter);
        res.json({ success: true, chartData });
    } catch (error) {
        console.error("Chart data error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch chart data" });
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(error => {
            if (error) {
                console.log("error destroying session", error);
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout", error);
        res.redirect("/pageError");

    }
}

const loadRefunds = async (req, res) => {
    try {
        const { search = "", status = "", page = 1, limit = 10 } = req.query;
        const filter = {};
        
        if (status) filter.status = status;

        if (search) {
            const Order = require("../../models/orderSchema");
            const cleanSearch = search.startsWith('#') ? search.substring(1) : search;
            const matchingOrders = await Order.find({ 
                orderId: { $regex: cleanSearch, $options: "i" } 
            }).select("_id");
            filter.orderId = { $in: matchingOrders.map(o => o._id) };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const refunds = await Refund.find(filter)
            .populate("userId", "name email")
            .populate("orderId", "orderId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalRefunds = await Refund.countDocuments(filter);
        const totalPages = Math.ceil(totalRefunds / limit);

        res.render("refunds", {
            refunds,
            search,
            status,
            currentPage: parseInt(page),
            totalPages
        });
    } catch (error) {
        console.error("Error loading refunds:", error);
        res.redirect("/admin/dashboard");
    }
};

const approveRefund = async (req, res) => {
    try {
        const { refundId } = req.params;
        await refundService.executeRefund(refundId);
        res.json({ success: true, message: "Refund credited to wallet successfully." });
    } catch (error) {
        console.error("Error approving refund:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to process refund." });
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    getChartData,
    pageError,
    logout,
    loadRefunds,
    approveRefund
};