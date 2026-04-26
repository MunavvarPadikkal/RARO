const mongoose = require('mongoose');
const Order = require('./models/orderSchema');
require('dotenv').config();

async function migrate() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const orders = await Order.find({});
        console.log(`Found ${orders.length} orders. Processing...`);
        let updatedCount = 0;

        for (const order of orders) {
            const items = order.orderedItems;
            if (!items || items.length === 0) continue;

            const allCancelled = items.every(i => i.itemStatus === "Cancelled");
            const allReturned = items.every(i => i.itemStatus === "Returned");
            const allReturnRequested = items.every(i => i.itemStatus === "Return Requested");

            let newStatus = order.orderStatus;
            
            if (allCancelled) {
                newStatus = "Cancelled";
            } else if (allReturned) {
                newStatus = "Returned";
            } else if (allReturnRequested) {
                newStatus = "Return Requested";
            } else {
                // For mixed statuses or rejections, default to Delivered if already past shipping phases
                // We protect Placed/Pending orders from being accidentally marked as Delivered
                const postDeliveryStatuses = ["Shipped", "Out for Delivery", "Delivered", "Return Approved", "Return Rejected", "Returned", "Partially Returned", "Partially Cancelled"];
                if (postDeliveryStatuses.includes(order.orderStatus)) {
                    newStatus = "Delivered";
                }
            }

            if (newStatus !== order.orderStatus) {
                console.log(`Updating Order ${order.orderId}: ${order.orderStatus} -> ${newStatus}`);
                order.orderStatus = newStatus;
                
                // Add to history for audit trail
                order.statusHistory.push({
                    status: newStatus,
                    date: new Date(),
                    note: "One-time status migration to standardized rules"
                });

                await order.save();
                updatedCount++;
            }
        }

        console.log(`\nMigration complete! Updated ${updatedCount} orders.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
