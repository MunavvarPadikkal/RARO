const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const moment = require("moment");

const getDashboardMetrics = async () => {
    const totalOrdersCount = await Order.countDocuments();

    const stats = await Order.aggregate([
        { $match: { orderStatus: { $nin: ["Cancelled", "Returned", "Payment Failed"] } } },
        {
            $project: {
                activeItems: {
                    $filter: {
                        input: "$orderedItems",
                        as: "item",
                        cond: { $not: { $in: ["$$item.itemStatus", ["Cancelled", "Returned"]] } }
                    }
                },
                discount: 1,
                walletAmountUsed: 1,
                finalAmount: 1,
                refundAmount: 1
            }
        },
        {
            $group: {
                _id: null,
                totalDeliveredOrders: { $sum: 1 },
                totalSales: { 
                    $sum: { 
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { 
                                $add: [
                                    "$$value", 
                                    { 
                                        $multiply: [
                                            { $ifNull: ["$$this.originalPrice", "$$this.price"] }, 
                                            "$$this.quantity"
                                        ] 
                                    }
                                ] 
                            }
                        }
                    } 
                },
                totalActiveItemRevenue: {
                    $sum: {
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { $add: ["$$value", "$$this.itemTotal"] }
                        }
                    }
                },
                totalOfferDiscount: { 
                    $sum: { 
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { 
                                $add: [
                                    "$$value", 
                                    { 
                                        $multiply: [
                                            { 
                                                $subtract: [
                                                    { $ifNull: ["$$this.originalPrice", "$$this.price"] }, 
                                                    "$$this.price"
                                                ] 
                                            }, 
                                            "$$this.quantity"
                                        ] 
                                    }
                                ] 
                            }
                        }
                    } 
                },
                totalCouponDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                totalWalletUsage: { $sum: "$walletAmountUsed" }
            }
        }
    ]);

    if (stats.length === 0) {
        return {
            totalOrders: totalOrdersCount,
            totalSales: 0,
            totalRevenue: 0,
            totalOfferDiscount: 0,
            totalCouponDiscount: 0,
            totalWalletUsage: 0,
            netRevenue: 0
        };
    }

    const data = stats[0];
    data.totalOrders = totalOrdersCount;
    data.totalRevenue = data.totalActiveItemRevenue - data.totalCouponDiscount;
    data.netRevenue = data.totalRevenue;
    return data;
};

const getSalesChartData = async (filter) => {
    let groupBy;
    let matchCondition = { orderStatus: { $nin: ["Cancelled", "Returned", "Payment Failed"] } };
    let dateLimit;

    const now = new Date();

    if (filter === "yearly") {
        groupBy = { $month: "$createdOn" };
        dateLimit = moment().startOf('year').toDate();
    } else if (filter === "monthly") {
        groupBy = { $dayOfMonth: "$createdOn" };
        dateLimit = moment().startOf('month').toDate();
    } else if (filter === "weekly") {
        groupBy = { $dayOfWeek: "$createdOn" };
        dateLimit = moment().startOf('week').toDate();
    } else {
        // Default to monthly if unknown
        groupBy = { $dayOfMonth: "$createdOn" };
        dateLimit = moment().startOf('month').toDate();
    }

    matchCondition.createdOn = { $gte: dateLimit };

    const chartData = await Order.aggregate([
        { $match: matchCondition },
        {
            $group: {
                _id: groupBy,
                sales: { $sum: "$finalAmount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    return chartData;
};

const getBestSellingMetrics = async () => {
    // Top 10 Products
    const topProducts = await Order.aggregate([
        { $match: { orderStatus: { $nin: ["Cancelled", "Returned", "Payment Failed"] } } },
        { $unwind: "$orderedItems" },
        { $match: { "orderedItems.itemStatus": { $nin: ["Cancelled", "Returned"] } } },
        {
            $group: {
                _id: "$orderedItems.productId",
                name: { $first: "$orderedItems.productName" },
                quantity: { $sum: "$orderedItems.quantity" },
                revenue: { $sum: "$orderedItems.itemTotal" }
            }
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
    ]);

    // Top 10 Categories
    const topCategories = await Order.aggregate([
        { $match: { orderStatus: { $nin: ["Cancelled", "Returned", "Payment Failed"] } } },
        { $unwind: "$orderedItems" },
        { $match: { "orderedItems.itemStatus": { $nin: ["Cancelled", "Returned"] } } },
        {
            $lookup: {
                from: "products",
                localField: "orderedItems.productId",
                foreignField: "_id",
                as: "product"
            }
        },
        { $unwind: "$product" },
        {
            $lookup: {
                from: "categories",
                localField: "product.category",
                foreignField: "_id",
                as: "category"
            }
        },
        { $unwind: "$category" },
        {
            $group: {
                _id: "$category._id",
                name: { $first: "$category.name" },
                quantity: { $sum: "$orderedItems.quantity" },
                revenue: { $sum: "$orderedItems.itemTotal" }
            }
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
    ]);

    return { topProducts, topCategories };
};

module.exports = {
    getDashboardMetrics,
    getSalesChartData,
    getBestSellingMetrics
};
