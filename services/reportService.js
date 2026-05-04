const Order = require("../models/orderSchema");
const moment = require("moment");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const getSalesReport = async (startDate, endDate) => {
    const matchCondition = {
        orderStatus: { $nin: ["Cancelled", "Returned", "Payment Failed"] },
        createdOn: {
            $gte: moment(startDate).startOf('day').toDate(),
            $lte: moment(endDate).endOf('day').toDate()
        }
    };

    const report = await Order.aggregate([
        { $match: matchCondition },
        {
            $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
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
                _id: "$date",
                orderCount: { $sum: 1 },
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
                offerDiscount: {
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
                couponDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                walletUsed: { $sum: { $ifNull: ["$walletAmountUsed", 0] } },
                totalActiveItemRevenue: {
                    $sum: {
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { $add: ["$$value", "$$this.itemTotal"] }
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                finalAmount: { $subtract: ["$totalActiveItemRevenue", "$couponDiscount"] }
            }
        },
        { $sort: { "_id": -1 } }
    ]);

    return report;
};

const generatePdfReport = (reportData, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fontSize(20).text("RARO Sales Report", { align: 'center' });
        doc.fontSize(10).text(`Period: ${moment(startDate).format('MMM DD, YYYY')} - ${moment(endDate).format('MMM DD, YYYY')}`, { align: 'center' });
        doc.moveDown();

        // Summary
        const summary = reportData.reduce((acc, row) => {
            acc.orders += row.orderCount;
            acc.sales += row.totalSales;
            acc.offer += row.offerDiscount;
            acc.coupon += row.couponDiscount;
            acc.wallet += row.walletUsed;
            acc.final += row.finalAmount;
            return acc;
        }, { orders: 0, sales: 0, offer: 0, coupon: 0, wallet: 0, final: 0 });

        doc.fontSize(12).text("Summary", { underline: true });
        doc.fontSize(10).text(`Total Orders: ${summary.orders}`);
        doc.text(`Gross Sales: INR ${summary.sales.toFixed(2)}`);
        doc.text(`Offer Discounts: INR ${summary.offer.toFixed(2)}`);
        doc.text(`Coupon Discounts: INR ${summary.coupon.toFixed(2)}`);
        doc.text(`Final Amount: INR ${summary.final.toFixed(2)}`);
        doc.moveDown();

        // Table
        const tableTop = 220;
        const columns = {
            date: { x: 30, label: 'Date' },
            orders: { x: 100, label: 'Orders' },
            sales: { x: 150, label: 'Gross' },
            offer: { x: 220, label: 'Offer' },
            coupon: { x: 290, label: 'Coupon' },
            wallet: { x: 360, label: 'Wallet' },
            final: { x: 430, label: 'Final' }
        };

        // Table Header
        doc.font('Helvetica-Bold');
        Object.values(columns).forEach(col => {
            doc.text(col.label, col.x, tableTop);
        });
        doc.moveTo(30, tableTop + 15).lineTo(565, tableTop + 15).stroke();
        doc.font('Helvetica');

        let y = tableTop + 25;
        reportData.forEach(row => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            doc.text(row._id, columns.date.x, y);
            doc.text(row.orderCount.toString(), columns.orders.x, y);
            doc.text(row.totalSales.toFixed(2), columns.sales.x, y);
            doc.text(row.offerDiscount.toFixed(2), columns.offer.x, y);
            doc.text(row.couponDiscount.toFixed(2), columns.coupon.x, y);
            doc.text(row.walletUsed.toFixed(2), columns.wallet.x, y);
            doc.text(row.finalAmount.toFixed(2), columns.final.x, y);
            y += 20;
        });

        doc.end();
    });
};

const generateExcelReport = async (reportData, startDate, endDate) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Gross Sales', key: 'sales', width: 15 },
        { header: 'Offer Discount', key: 'offer', width: 15 },
        { header: 'Coupon Discount', key: 'coupon', width: 15 },
        { header: 'Wallet Used', key: 'wallet', width: 15 },
        { header: 'Final Amount', key: 'final', width: 15 }
    ];

    reportData.forEach(row => {
        worksheet.addRow({
            date: row._id,
            orders: row.orderCount,
            sales: row.totalSales,
            offer: row.offerDiscount,
            coupon: row.couponDiscount,
            wallet: row.walletUsed,
            final: row.finalAmount
        });
    });

    // Styling
    worksheet.getRow(1).font = { bold: true };
    
    return await workbook.xlsx.writeBuffer();
};

module.exports = {
    getSalesReport,
    generatePdfReport,
    generateExcelReport
};
