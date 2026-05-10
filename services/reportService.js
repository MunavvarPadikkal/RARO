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
                shippingCharge: { $ifNull: ["$shippingCharge", 0] }
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
                                            { 
                                                $cond: {
                                                    if: { $gt: ["$$this.originalPrice", 0] },
                                                    then: "$$this.originalPrice",
                                                    else: "$$this.price"
                                                }
                                            }, 
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
                                                    { 
                                                        $cond: {
                                                            if: { $gt: ["$$this.originalPrice", 0] },
                                                            then: "$$this.originalPrice",
                                                            else: "$$this.price"
                                                        }
                                                    }, 
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
                // Use the proportional coupon discount stored on active items
                couponDiscount: { 
                    $sum: {
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { $add: ["$$value", { $ifNull: ["$$this.totalCouponDiscount", 0] }] }
                        }
                    }
                },
                walletUsed: { $sum: { $ifNull: ["$walletAmountUsed", 0] } },
                totalActiveItemRevenue: {
                    $sum: {
                        $reduce: {
                            input: "$activeItems",
                            initialValue: 0,
                            in: { $add: ["$$value", "$$this.itemTotal"] }
                        }
                    }
                },
                totalShipping: { $sum: "$shippingCharge" }
            }
        },
        {
            $addFields: {
                // finalAmount = (Sum of active item totals) - (Sum of active item coupon discounts) + Shipping
                finalAmount: { 
                    $add: [
                        { $subtract: ["$totalActiveItemRevenue", "$couponDiscount"] }, 
                        "$totalShipping" 
                    ] 
                }
            }
        },
        { $sort: { "_id": -1 } }
    ]);

    return report;
};

const generatePdfReport = (reportData, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Brand Colors & Config ---
        const colors = {
            primary: '#ff6b00', // RARO Orange
            dark: '#111111',
            gray: '#666666',
            lightGray: '#f8f8f8',
            border: '#e5e5e5'
        };

        // Helper to draw summary cards
        const drawCard = (x, y, w, h, label, value, isPrimary = false) => {
            doc.rect(x, y, w, h).fill(isPrimary ? colors.primary : colors.lightGray);
            doc.fillColor(isPrimary ? '#ffffff' : colors.gray).fontSize(8).font('Helvetica-Bold').text(label, x + 12, y + 15);
            doc.fillColor(isPrimary ? '#ffffff' : colors.dark).fontSize(14).font('Helvetica-Bold').text(value, x + 12, y + 30);
        };

        // --- Header Section ---
        doc.fillColor(colors.dark).fontSize(26).font('Helvetica-Bold').text("RARO", 40, 40);
        doc.fontSize(10).font('Helvetica').fillColor(colors.gray).text("Wear What's Rare", 40, 68);

        doc.fillColor(colors.dark).fontSize(16).font('Helvetica-Bold').text("SALES REPORT", 40, 40, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor(colors.gray).text(`Generated: ${moment().format('MMM DD, YYYY HH:mm')}`, 40, 62, { align: 'right' });
        doc.text(`Period: ${moment(startDate).format('MMM DD, YYYY')} - ${moment(endDate).format('MMM DD, YYYY')}`, 40, 75, { align: 'right' });

        doc.moveTo(40, 105).lineTo(555, 105).strokeColor(colors.border).lineWidth(1).stroke();

        // --- Summary Calculation ---
        const summary = reportData.reduce((acc, row) => {
            acc.orders += row.orderCount;
            acc.sales += row.totalSales;
            acc.offer += row.offerDiscount;
            acc.coupon += row.couponDiscount;
            acc.final += row.finalAmount;
            return acc;
        }, { orders: 0, sales: 0, offer: 0, coupon: 0, final: 0 });

        // --- Summary Cards ---
        const startY = 125;
        const cardWidth = 160;
        const cardHeight = 60;
        
        drawCard(40, startY, cardWidth, cardHeight, "TOTAL ORDERS", summary.orders.toString());
        drawCard(215, startY, cardWidth, cardHeight, "GROSS SALES", `INR ${summary.sales.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
        drawCard(390, startY, cardWidth, cardHeight, "NET REVENUE", `INR ${summary.final.toLocaleString(undefined, {minimumFractionDigits: 2})}`, true);

        // --- Table Header ---
        const tableTop = 220;
        const colX = { date: 40, orders: 120, gross: 180, offer: 270, coupon: 360, net: 450 };
        const colWidths = { date: 80, orders: 60, gross: 90, offer: 90, coupon: 90, net: 105 };

        doc.rect(40, tableTop, 515, 25).fill(colors.dark);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        doc.text("DATE", colX.date + 5, tableTop + 8);
        doc.text("ORDERS", colX.orders, tableTop + 8, { width: colWidths.orders, align: 'center' });
        doc.text("GROSS", colX.gross, tableTop + 8, { width: colWidths.gross, align: 'right' });
        doc.text("OFFER", colX.offer, tableTop + 8, { width: colWidths.offer, align: 'right' });
        doc.text("COUPON", colX.coupon, tableTop + 8, { width: colWidths.coupon, align: 'right' });
        doc.text("NET REVENUE", colX.net, tableTop + 8, { width: colWidths.net, align: 'right' });

        // --- Table Body ---
        let y = tableTop + 25;
        doc.font('Helvetica').fontSize(9).fillColor(colors.dark);

        reportData.forEach((row, index) => {
            // Check for page break
            if (y > 750) {
                doc.addPage();
                y = 50;
                // Re-draw table header on new page
                doc.rect(40, y, 515, 25).fill(colors.dark);
                doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
                doc.text("DATE", colX.date + 5, y + 8);
                doc.text("ORDERS", colX.orders, y + 8, { width: colWidths.orders, align: 'center' });
                doc.text("GROSS", colX.gross, y + 8, { width: colWidths.gross, align: 'right' });
                doc.text("OFFER", colX.offer, y + 8, { width: colWidths.offer, align: 'right' });
                doc.text("COUPON", colX.coupon, y + 8, { width: colWidths.coupon, align: 'right' });
                doc.text("NET REVENUE", colX.net, y + 8, { width: colWidths.net, align: 'right' });
                y += 25;
            }

            // Zebra Striping
            if (index % 2 === 0) {
                doc.rect(40, y, 515, 20).fill(colors.lightGray);
                doc.fillColor(colors.dark);
            } else {
                doc.fillColor(colors.dark);
            }

            doc.font('Helvetica').text(row._id, colX.date + 5, y + 6);
            doc.text(row.orderCount.toString(), colX.orders, y + 6, { width: colWidths.orders, align: 'center' });
            doc.text(row.totalSales.toFixed(2), colX.gross, y + 6, { width: colWidths.gross, align: 'right' });
            doc.text(row.offerDiscount.toFixed(2), colX.offer, y + 6, { width: colWidths.offer, align: 'right' });
            doc.text(row.couponDiscount.toFixed(2), colX.coupon, y + 6, { width: colWidths.coupon, align: 'right' });
            doc.font('Helvetica-Bold').text(row.finalAmount.toFixed(2), colX.net, y + 6, { width: colWidths.net, align: 'right' });
            
            y += 20;
        });

        // --- Final Totals Row ---
        doc.rect(40, y, 515, 25).fill('#f1f1f1');
        doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(9);
        doc.text("TOTAL", colX.date + 5, y + 8);
        doc.text(summary.orders.toString(), colX.orders, y + 8, { width: colWidths.orders, align: 'center' });
        doc.text(summary.sales.toFixed(2), colX.gross, y + 8, { width: colWidths.gross, align: 'right' });
        doc.text(summary.offer.toFixed(2), colX.offer, y + 8, { width: colWidths.offer, align: 'right' });
        doc.text(summary.coupon.toFixed(2), colX.coupon, y + 8, { width: colWidths.coupon, align: 'right' });
        doc.text(summary.final.toFixed(2), colX.net, y + 8, { width: colWidths.net, align: 'right' });

        // --- Footer (Page Numbers) ---
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor(colors.gray).text(
                `Page ${i + 1} of ${range.count} | RARO Official Business Report`,
                40,
                doc.page.height - 40,
                { align: 'center' }
            );
        }

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
